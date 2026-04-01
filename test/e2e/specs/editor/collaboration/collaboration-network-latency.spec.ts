/**
 * Collaboration – Network Latency & Data Resolution
 *
 * Simulates two users editing the same post where User A has a fast
 * connection and User B has high latency (~800 ms round-trip on sync
 * requests). The tests capture the actual network request/response
 * flow, verify that the CRDT layer resolves divergent states, and
 * confirm that persisted data is identical for both users.
 *
 * Playwright's `page.route()` is used to add artificial delay to
 * wp-sync polling requests on User B's page only, creating a
 * realistic asymmetric-latency scenario without touching the server.
 */

/**
 * External dependencies
 */
import type { Page, Route, Request } from '@playwright/test';

/**
 * WordPress dependencies
 */
import type { Editor } from '@wordpress/e2e-test-utils-playwright';

/**
 * Internal dependencies
 */
import { test, expect } from './fixtures';

// ── Constants ───────────────────────────────────────────────────────

const HIGH_LATENCY_MS = 800;
/** Standard convergence timeout matching existing collaboration tests. */
const SYNC_TIMEOUT = 10_000;
/** Extended timeout for stress tests with many operations under latency. */
const STRESS_TIMEOUT = 16_000;

// ── Latency simulation ─────────────────────────────────────────────

/**
 * Install a route handler that delays wp-sync responses by `delayMs`
 * milliseconds, simulating high-latency network conditions.
 *
 * @param {Page}   page    The Playwright page to throttle.
 * @param {number} delayMs Delay in milliseconds to add to each sync response.
 * @return {Function} Teardown function that removes the handler.
 */
async function addSyncLatency(
	page: Page,
	delayMs: number
): Promise< () => Promise< void > > {
	const handler = async ( route: Route ) => {
		const response = await route.fetch();
		await new Promise( ( resolve ) => setTimeout( resolve, delayMs ) );
		await route.fulfill( { response } );
	};

	await page.route( ( url ) => url.href.includes( 'wp-sync' ), handler );
	return () => page.unrouteAll( { behavior: 'ignoreErrors' } );
}

// ── Traffic capture ─────────────────────────────────────────────────

interface TimestampedEntry {
	timestamp: number;
	url: string;
}

interface RequestLog {
	requests: TimestampedEntry[];
	responses: TimestampedEntry[];
}

/**
 * Start capturing wp-sync request/response timestamps on a page.
 *
 * @param {Page} page The Playwright page to monitor.
 * @return {{ log: RequestLog, stop: Function }} Live log and stop function.
 */
function captureSyncTraffic( page: Page ): {
	log: RequestLog;
	stop: () => void;
} {
	const log: RequestLog = { requests: [], responses: [] };

	const onRequest = ( request: Request ) => {
		if ( request.url().includes( 'wp-sync' ) ) {
			log.requests.push( {
				timestamp: Date.now(),
				url: request.url(),
			} );
		}
	};

	const onResponse = ( response: import('@playwright/test').Response ) => {
		if ( response.url().includes( 'wp-sync' ) ) {
			log.responses.push( {
				timestamp: Date.now(),
				url: response.url(),
			} );
		}
	};

	page.on( 'request', onRequest );
	page.on( 'response', onResponse );

	return {
		log,
		stop: () => {
			page.off( 'request', onRequest );
			page.off( 'response', onResponse );
		},
	};
}

/**
 * Compute average response latency from a request log.
 *
 * @param {RequestLog} log The captured traffic log.
 * @return {number} Average response time in milliseconds.
 */
function avgResponseTime( log: RequestLog ): number {
	if ( log.requests.length === 0 || log.responses.length === 0 ) {
		return 0;
	}
	const durations: number[] = [];
	let reqIdx = 0;
	for ( const res of log.responses ) {
		while (
			reqIdx < log.requests.length - 1 &&
			log.requests[ reqIdx + 1 ].timestamp <= res.timestamp
		) {
			reqIdx++;
		}
		durations.push( res.timestamp - log.requests[ reqIdx ].timestamp );
	}
	return durations.reduce( ( a, b ) => a + b, 0 ) / durations.length;
}

// ── Block helpers ───────────────────────────────────────────────────

/**
 * Insert a paragraph block on a remote page via the data API.
 *
 * @param {Page}   page    The Playwright page to insert on.
 * @param {string} content The paragraph text content.
 */
function insertRemoteParagraph( page: Page, content: string ) {
	return page.evaluate( ( text: string ) => {
		const block = window.wp.blocks.createBlock( 'core/paragraph', {
			content: text,
		} );
		window.wp.data.dispatch( 'core/block-editor' ).insertBlock( block );
	}, content );
}

/**
 * Strip clientIds from a block tree for structural comparison.
 * Uses the same JSON.stringify replacer pattern as the gauntlet spec.
 *
 * @param {Array} blocks Block tree from editor.getBlocks().
 * @return {Array} Block tree without clientId keys.
 */
function stripClientIds(
	blocks: Record< string, unknown >[]
): Record< string, unknown >[] {
	return JSON.parse(
		JSON.stringify( blocks, ( key, value ) =>
			key === 'clientId' ? undefined : value
		)
	);
}

/**
 * Assert that all editors in the session have converged to a state
 * containing all expected content strings (deep search via JSON.stringify).
 *
 * @param {Editor[]} editors  Editor instances to check.
 * @param {string[]} expected Content strings that must all be present.
 * @param {number}   timeout  Maximum wait time in ms.
 */
async function assertConvergence(
	editors: Editor[],
	expected: string[],
	timeout = SYNC_TIMEOUT
) {
	for ( const ed of editors ) {
		await expect( async () => {
			const allContent = JSON.stringify( await ed.getBlocks() );
			for ( const text of expected ) {
				expect( allContent ).toContain( text );
			}
		} ).toPass( { timeout } );
	}
}

/**
 * Assert that two editors have structurally identical block trees.
 *
 * @param {Editor} editorA First editor instance.
 * @param {Editor} editorB Second editor instance.
 */
async function assertIdenticalBlocks( editorA: Editor, editorB: Editor ) {
	const blocksA = await editorA.getBlocks();
	const blocksB = await editorB.getBlocks();
	expect( stripClientIds( blocksA ) ).toEqual( stripClientIds( blocksB ) );
}

// ── Tests ───────────────────────────────────────────────────────────

test.describe( 'Collaboration - Network Latency', () => {
	test( 'high-latency user receives updates and sync traffic is measurably delayed', async ( {
		collaborationUtils,
		requestUtils,
		editor,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Latency - Traffic Capture',
			status: 'draft',
			date_gmt: new Date().toISOString(),
		} );
		await collaborationUtils.openCollaborativeSession( post.id );

		const { page2, editor2 } = collaborationUtils;

		const removeSyncLatency = await addSyncLatency(
			page2,
			HIGH_LATENCY_MS
		);
		const userATraffic = captureSyncTraffic(
			collaborationUtils.allPages[ 0 ]
		);
		const userBTraffic = captureSyncTraffic( page2 );

		await editor.insertBlock( {
			name: 'core/paragraph',
			attributes: { content: 'Fast user says hello' },
		} );

		await expect
			.poll( () => editor2.getBlocks(), { timeout: SYNC_TIMEOUT } )
			.toMatchObject( [
				{
					name: 'core/paragraph',
					attributes: { content: 'Fast user says hello' },
				},
			] );

		userATraffic.stop();
		userBTraffic.stop();
		await removeSyncLatency();

		expect( userATraffic.log.requests.length ).toBeGreaterThan( 0 );
		expect( userBTraffic.log.requests.length ).toBeGreaterThan( 0 );
		// User B should be at least 500ms slower (we injected 800ms).
		expect(
			avgResponseTime( userBTraffic.log ) -
				avgResponseTime( userATraffic.log )
		).toBeGreaterThan( 500 );
	} );

	test( 'concurrent edits under asymmetric latency resolve to identical state', async ( {
		collaborationUtils,
		requestUtils,
		editor,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Latency - Concurrent Resolution',
			status: 'draft',
			date_gmt: new Date().toISOString(),
		} );
		await collaborationUtils.openCollaborativeSession( post.id );

		const { page2, editor2 } = collaborationUtils;
		const removeSyncLatency = await addSyncLatency(
			page2,
			HIGH_LATENCY_MS
		);

		// Two rounds of concurrent inserts to create divergence.
		await Promise.all( [
			editor.insertBlock( {
				name: 'core/paragraph',
				attributes: { content: 'Fast: block 1' },
			} ),
			insertRemoteParagraph( page2, 'Slow: block 1' ),
		] );
		await Promise.all( [
			editor.insertBlock( {
				name: 'core/paragraph',
				attributes: { content: 'Fast: block 2' },
			} ),
			insertRemoteParagraph( page2, 'Slow: block 2' ),
		] );

		await assertConvergence( collaborationUtils.allEditors, [
			'Fast: block 1',
			'Fast: block 2',
			'Slow: block 1',
			'Slow: block 2',
		] );
		await assertIdenticalBlocks( editor, editor2 );
		expect( await editor.getBlocks() ).toHaveLength( 4 );

		await removeSyncLatency();
	} );

	test( 'interleaved block inserts under latency merge without data loss', async ( {
		collaborationUtils,
		requestUtils,
		editor,
		page,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Latency - Interleaved Inserts',
			content:
				'<!-- wp:paragraph -->\n<p>Seed paragraph</p>\n<!-- /wp:paragraph -->',
			status: 'draft',
			date_gmt: new Date().toISOString(),
		} );
		await collaborationUtils.openCollaborativeSession( post.id );

		const { page2, editor2 } = collaborationUtils;
		const removeSyncLatency = await addSyncLatency(
			page2,
			HIGH_LATENCY_MS
		);

		await Promise.all( [
			insertRemoteParagraph( page, 'Alpha Bravo Charlie' ),
			insertRemoteParagraph( page2, 'Delta Echo Foxtrot' ),
		] );

		await assertConvergence( collaborationUtils.allEditors, [
			'Alpha Bravo Charlie',
			'Delta Echo Foxtrot',
			'Seed paragraph',
		] );
		await assertIdenticalBlocks( editor, editor2 );
		expect( await editor.getBlocks() ).toHaveLength( 3 );

		await removeSyncLatency();
	} );

	test( 'persisted CRDT document is consistent after save under latency', async ( {
		collaborationUtils,
		requestUtils,
		editor,
		page,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Latency - Persistence',
			status: 'draft',
			date_gmt: new Date().toISOString(),
		} );
		await collaborationUtils.openCollaborativeSession( post.id );

		const { page2 } = collaborationUtils;
		const removeSyncLatency = await addSyncLatency(
			page2,
			HIGH_LATENCY_MS
		);

		await Promise.all( [
			editor.insertBlock( {
				name: 'core/paragraph',
				attributes: { content: 'Persisted from fast user' },
			} ),
			insertRemoteParagraph( page2, 'Persisted from slow user' ),
		] );

		await assertConvergence( collaborationUtils.allEditors, [
			'Persisted from fast user',
			'Persisted from slow user',
		] );

		await removeSyncLatency();
		await editor.saveDraft();

		const crdtBeforeReload =
			await collaborationUtils.getCrdtDocument( page );
		expect( crdtBeforeReload ).toBeTruthy();

		await page.reload();
		await collaborationUtils.waitForEntityReadyAndSaveSettled( page );

		expect( await collaborationUtils.getCrdtDocument( page ) ).toBe(
			crdtBeforeReload
		);

		await expect
			.poll( () => editor.getBlocks(), { timeout: SYNC_TIMEOUT } )
			.toMatchObject(
				expect.arrayContaining( [
					expect.objectContaining( {
						attributes: expect.objectContaining( {
							content: 'Persisted from fast user',
						} ),
					} ),
					expect.objectContaining( {
						attributes: expect.objectContaining( {
							content: 'Persisted from slow user',
						} ),
					} ),
				] )
			);
	} );

	test( 'stress: rapid alternating inserts under latency converge', async ( {
		collaborationUtils,
		requestUtils,
		editor,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Latency Stress - Rapid Alternating',
			status: 'draft',
			date_gmt: new Date().toISOString(),
		} );
		await collaborationUtils.openCollaborativeSession( post.id );

		const { page2, editor2 } = collaborationUtils;
		const removeSyncLatency = await addSyncLatency(
			page2,
			HIGH_LATENCY_MS
		);

		const ROUNDS = 10;
		for ( let i = 0; i < ROUNDS; i++ ) {
			if ( i % 2 === 0 ) {
				await editor.insertBlock( {
					name: 'core/paragraph',
					attributes: { content: `A-round-${ i }` },
				} );
				await insertRemoteParagraph( page2, `B-round-${ i }` );
			} else {
				await insertRemoteParagraph( page2, `B-round-${ i }` );
				await editor.insertBlock( {
					name: 'core/paragraph',
					attributes: { content: `A-round-${ i }` },
				} );
			}
		}

		const allExpected = Array.from( { length: ROUNDS }, ( _, i ) => [
			`A-round-${ i }`,
			`B-round-${ i }`,
		] ).flat();

		await assertConvergence(
			collaborationUtils.allEditors,
			allExpected,
			STRESS_TIMEOUT
		);
		await assertIdenticalBlocks( editor, editor2 );

		// Verify exact count.
		await expect
			.poll( () => editor.getBlocks(), { timeout: SYNC_TIMEOUT } )
			.toHaveLength( ROUNDS * 2 );

		await removeSyncLatency();
	} );

	test( 'stress: simultaneous burst inserts under latency converge', async ( {
		collaborationUtils,
		requestUtils,
		editor,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Latency Stress - Burst',
			status: 'draft',
			date_gmt: new Date().toISOString(),
		} );
		await collaborationUtils.openCollaborativeSession( post.id );

		const { page2, editor2 } = collaborationUtils;
		const removeSyncLatency = await addSyncLatency(
			page2,
			HIGH_LATENCY_MS
		);

		const COUNT = 8;
		await Promise.all( [
			( async () => {
				for ( let i = 0; i < COUNT; i++ ) {
					await editor.insertBlock( {
						name: 'core/paragraph',
						attributes: { content: `Fast-${ i }` },
					} );
				}
			} )(),
			page2.evaluate( ( n: number ) => {
				for ( let i = 0; i < n; i++ ) {
					const block = window.wp.blocks.createBlock(
						'core/paragraph',
						{ content: `Slow-${ i }` }
					);
					window.wp.data
						.dispatch( 'core/block-editor' )
						.insertBlock( block );
				}
			}, COUNT ),
		] );

		const allExpected = [
			...Array.from( { length: COUNT }, ( _, i ) => `Fast-${ i }` ),
			...Array.from( { length: COUNT }, ( _, i ) => `Slow-${ i }` ),
		];

		await assertConvergence(
			collaborationUtils.allEditors,
			allExpected,
			STRESS_TIMEOUT
		);
		await assertIdenticalBlocks( editor, editor2 );

		await removeSyncLatency();
	} );

	test( 'stress: mixed block types and attribute changes under latency', async ( {
		collaborationUtils,
		requestUtils,
		editor,
		page,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Latency Stress - Mixed Types',
			status: 'draft',
			date_gmt: new Date().toISOString(),
		} );
		await collaborationUtils.openCollaborativeSession( post.id );

		const { page2, editor2 } = collaborationUtils;
		const removeSyncLatency = await addSyncLatency(
			page2,
			HIGH_LATENCY_MS
		);

		// User A inserts diverse block types.
		await editor.insertBlock( {
			name: 'core/heading',
			attributes: { content: 'Fast heading', level: 2 },
		} );
		await editor.insertBlock( {
			name: 'core/paragraph',
			attributes: { content: 'Fast paragraph one' },
		} );
		await editor.insertBlock( {
			name: 'core/list',
			innerBlocks: [
				{
					name: 'core/list-item',
					attributes: { content: 'Fast item A' },
				},
				{
					name: 'core/list-item',
					attributes: { content: 'Fast item B' },
				},
			],
		} );

		// User B inserts different block types concurrently.
		await page2.evaluate( () => {
			const { createBlock } = window.wp.blocks;
			const { dispatch } = window.wp.data;
			dispatch( 'core/block-editor' ).insertBlock(
				createBlock( 'core/heading', {
					content: 'Slow heading',
					level: 3,
				} )
			);
			dispatch( 'core/block-editor' ).insertBlock(
				createBlock( 'core/paragraph', {
					content: 'Slow paragraph one',
				} )
			);
			dispatch( 'core/block-editor' ).insertBlock(
				createBlock( 'core/quote', {}, [
					createBlock( 'core/paragraph', {
						content: 'Slow quote inner',
					} ),
				] )
			);
		} );

		// User A modifies heading level via updateBlockAttributes.
		await page.evaluate( () => {
			const blocks = window.wp.data
				.select( 'core/block-editor' )
				.getBlocks();
			const heading = blocks.find(
				( b: any ) =>
					b.name === 'core/heading' &&
					b.attributes.content === 'Fast heading'
			);
			if ( heading ) {
				window.wp.data
					.dispatch( 'core/block-editor' )
					.updateBlockAttributes( heading.clientId, { level: 4 } );
			}
		} );

		// Wait for all blocks to appear on both sides.
		await assertConvergence(
			collaborationUtils.allEditors,
			[
				'Fast heading',
				'Fast paragraph',
				'Fast item A',
				'Slow heading',
				'Slow paragraph',
				'Slow quote inner',
			],
			STRESS_TIMEOUT
		);

		// Verify block types converged.
		for ( const ed of collaborationUtils.allEditors ) {
			await expect( async () => {
				const blocks = await ed.getBlocks();
				const names = blocks.map( ( b: any ) => b.name );
				expect(
					names.filter( ( n: string ) => n === 'core/heading' )
				).toHaveLength( 2 );
				expect( names ).toContain( 'core/list' );
				expect( names ).toContain( 'core/quote' );
			} ).toPass( { timeout: SYNC_TIMEOUT } );
		}

		// Both users must agree on all attribute values.
		await assertIdenticalBlocks( editor, editor2 );
		expect( await editor.getBlocks() ).toHaveLength( 6 );

		await removeSyncLatency();
	} );

	test( 'stress: deletion plus insertion under latency converge consistently', async ( {
		collaborationUtils,
		requestUtils,
		editor,
		page,
	} ) => {
		const paragraphs = Array.from(
			{ length: 4 },
			( _, i ) =>
				`<!-- wp:paragraph -->\n<p>Block ${ i }</p>\n<!-- /wp:paragraph -->`
		).join( '\n' );

		const post = await requestUtils.createPost( {
			title: 'Latency Stress - Deletions',
			content: paragraphs,
			status: 'draft',
			date_gmt: new Date().toISOString(),
		} );
		await collaborationUtils.openCollaborativeSession( post.id );

		const { page2, editor2 } = collaborationUtils;
		const removeSyncLatency = await addSyncLatency(
			page2,
			HIGH_LATENCY_MS
		);

		// User A deletes the first two blocks.
		await page.evaluate( () => {
			const blocks = window.wp.data
				.select( 'core/block-editor' )
				.getBlocks();
			const ids = blocks
				.filter( ( b: any ) =>
					[ 'Block 0', 'Block 1' ].includes( b.attributes.content )
				)
				.map( ( b: any ) => b.clientId );
			window.wp.data.dispatch( 'core/block-editor' ).removeBlocks( ids );
		} );

		// User B inserts a new block (doesn't touch deleted ones).
		await insertRemoteParagraph( page2, 'New from B' );

		await assertConvergence(
			collaborationUtils.allEditors,
			[ 'Block 2', 'Block 3', 'New from B' ],
			STRESS_TIMEOUT
		);
		await assertIdenticalBlocks( editor, editor2 );

		await removeSyncLatency();
	} );

	test( 'stress: concurrent edits then save and reload preserves all data', async ( {
		collaborationUtils,
		requestUtils,
		editor,
		page,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Latency Stress - Save Reload',
			status: 'draft',
			date_gmt: new Date().toISOString(),
		} );
		await collaborationUtils.openCollaborativeSession( post.id );

		const { page2 } = collaborationUtils;
		const removeSyncLatency = await addSyncLatency(
			page2,
			HIGH_LATENCY_MS
		);

		const COUNT = 5;
		await Promise.all( [
			( async () => {
				for ( let i = 0; i < COUNT; i++ ) {
					await editor.insertBlock( {
						name: 'core/paragraph',
						attributes: { content: `Save-A-${ i }` },
					} );
				}
			} )(),
			page2.evaluate( ( n: number ) => {
				for ( let i = 0; i < n; i++ ) {
					const block = window.wp.blocks.createBlock(
						'core/paragraph',
						{ content: `Save-B-${ i }` }
					);
					window.wp.data
						.dispatch( 'core/block-editor' )
						.insertBlock( block );
				}
			}, COUNT ),
		] );

		const allExpected = [
			...Array.from( { length: COUNT }, ( _, i ) => `Save-A-${ i }` ),
			...Array.from( { length: COUNT }, ( _, i ) => `Save-B-${ i }` ),
		];

		await assertConvergence(
			collaborationUtils.allEditors,
			allExpected,
			STRESS_TIMEOUT
		);
		await removeSyncLatency();

		// Snapshot converged state, save, reload, verify.
		const convergedBlocks = stripClientIds( await editor.getBlocks() );

		await editor.saveDraft();
		await page.reload();
		await collaborationUtils.waitForEntityReadyAndSaveSettled( page );

		await expect( async () => {
			expect( stripClientIds( await editor.getBlocks() ) ).toEqual(
				convergedBlocks
			);
		} ).toPass( { timeout: SYNC_TIMEOUT } );
	} );

	test( 'request volume: high-latency user does not flood the server with retries', async ( {
		collaborationUtils,
		requestUtils,
		editor,
	} ) => {
		const post = await requestUtils.createPost( {
			title: 'Latency - Request Volume',
			status: 'draft',
			date_gmt: new Date().toISOString(),
		} );
		await collaborationUtils.openCollaborativeSession( post.id );

		const { page2, editor2 } = collaborationUtils;
		const removeSyncLatency = await addSyncLatency(
			page2,
			HIGH_LATENCY_MS
		);

		const userATraffic = captureSyncTraffic(
			collaborationUtils.allPages[ 0 ]
		);
		const userBTraffic = captureSyncTraffic( page2 );

		for ( let i = 0; i < 5; i++ ) {
			await editor.insertBlock( {
				name: 'core/paragraph',
				attributes: { content: `Paragraph ${ i + 1 }` },
			} );
		}

		await expect
			.poll( () => editor2.getBlocks(), { timeout: STRESS_TIMEOUT } )
			.toHaveLength( 5 );

		userATraffic.stop();
		userBTraffic.stop();
		await removeSyncLatency();

		const ratio =
			userBTraffic.log.requests.length /
			Math.max( userATraffic.log.requests.length, 1 );
		expect( ratio ).toBeLessThan( 2.5 );
	} );
} );
