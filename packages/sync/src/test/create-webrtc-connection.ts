/**
 * External dependencies
 */
import {
	describe,
	expect,
	it,
	jest,
	beforeEach,
	afterEach,
} from '@jest/globals';
import * as Y from 'yjs';

/**
 * Internal dependencies
 */
import { createWebRTCConnection } from '../create-webrtc-connection';
import { WebrtcProviderWithHttpSignaling } from '../webrtc-http-stream-signaling';

// Mock the WebRTC provider to avoid network connections in tests
jest.mock( '../webrtc-http-stream-signaling', () => ( {
	WebrtcProviderWithHttpSignaling: jest.fn(),
} ) );

describe( 'createWebRTCConnection', () => {
	let doc: Y.Doc;
	const mockProvider = WebrtcProviderWithHttpSignaling as jest.Mock< any >;

	beforeEach( () => {
		doc = new Y.Doc();
		jest.clearAllMocks();
	} );

	afterEach( () => {
		doc?.destroy();
	} );

	it( 'creates a connection function', () => {
		const connectDoc = createWebRTCConnection( {
			signaling: [ 'ws://localhost:4444' ],
		} );

		expect( typeof connectDoc ).toBe( 'function' );
	} );

	it( 'creates WebrtcProvider with room name in format "objectType-objectId"', async () => {
		const connectDoc = createWebRTCConnection( {
			signaling: [ 'ws://localhost:4444' ],
		} );

		await connectDoc( '789', 'post', doc );

		expect( mockProvider ).toHaveBeenCalledWith(
			'post-789',
			doc,
			expect.objectContaining( {
				signaling: [ 'ws://localhost:4444' ],
			} )
		);
	} );

	it( 'passes signaling servers to WebrtcProvider', async () => {
		const signaling = [
			'ws://localhost:4444',
			'ws://localhost:5555',
			'wss://example.com/signaling',
		];
		const connectDoc = createWebRTCConnection( { signaling } );

		await connectDoc( '100', 'page', doc );

		expect( mockProvider ).toHaveBeenCalledWith(
			'page-100',
			doc,
			expect.objectContaining( { signaling } )
		);
	} );

	it( 'passes password to WebrtcProvider when provided', async () => {
		const connectDoc = createWebRTCConnection( {
			signaling: [ 'ws://localhost:4444' ],
			password: 'test-password',
		} );

		await connectDoc( '456', 'post', doc );

		expect( mockProvider ).toHaveBeenCalledWith(
			'post-456',
			doc,
			expect.objectContaining( {
				password: 'test-password',
			} )
		);
	} );

	it( 'returns promise with no-op destroy method', async () => {
		const connectDoc = createWebRTCConnection( {
			signaling: [ 'ws://localhost:4444' ],
		} );

		const result = await connectDoc( '789', 'post', doc );

		expect( result ).toBeDefined();
		expect( typeof result.destroy ).toBe( 'function' );
		expect( () => result.destroy() ).not.toThrow();
	} );
} );
