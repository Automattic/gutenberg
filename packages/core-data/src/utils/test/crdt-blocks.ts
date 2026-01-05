/**
 * WordPress dependencies
 */
import { Y } from '@wordpress/sync';

/**
 * External dependencies
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

/**
 * Mock uuid module
 */
jest.mock( 'uuid', () => ( {
	// eslint-disable-next-line no-restricted-syntax
	v4: jest.fn( () => 'mocked-uuid-' + Math.random() ),
} ) );

/**
 * Mock @wordpress/blocks module
 */
jest.mock( '@wordpress/blocks', () => ( {
	getBlockTypes: jest.fn( () => [
		{
			name: 'core/paragraph',
			attributes: { content: { type: 'rich-text' } },
		},
	] ),
} ) );

/**
 * Internal dependencies
 */
import {
	mergeCrdtBlocks,
	type Block,
	type YBlock,
	type YBlockProperties,
	type YBlockAttributes,
} from '../crdt-blocks';

describe( 'crdt-blocks', () => {
	let doc: Y.Doc;
	let rootBlockIds: Y.Array< string >;
	let blockProperties: YBlockProperties;

	beforeEach( () => {
		doc = new Y.Doc();
		rootBlockIds = doc.getArray< string >( 'rootBlockIds' );
		blockProperties = doc.getMap< YBlock >( 'blockProperties' );
		jest.clearAllMocks();
	} );

	// Helper to get a block by ID with a defined type.
	const getBlockById = ( blockId: string | undefined ): YBlock => {
		if ( typeof blockId !== 'string' ) {
			expect( blockId ).toBe( "a string (but it wasn't)" );
			// TypeScript needs a return, but expect will fail the test
			return {} as YBlock;
		}
		const block = blockProperties.get( blockId );
		if ( typeof block === 'undefined' ) {
			expect( block ).toBeDefined();
			// TypeScript needs a return, but expect will fail the test
			return {} as YBlock;
		}
		return block;
	};

	afterEach( () => {
		doc.destroy();
	} );

	describe( 'mergeCrdtBlocks', () => {
		it( 'inserts new blocks into empty Y.Array', () => {
			const incomingBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Hello World' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				incomingBlocks,
				null
			);

			expect( rootBlockIds.length ).toBe( 1 );
			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );
			expect( block.get( 'name' ) ).toBe( 'core/paragraph' );
			const content = (
				block.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( content.toString() ).toBe( 'Hello World' );
		} );

		it( 'updates existing blocks when content changes', () => {
			const initialBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Initial content' },
					innerBlocks: [],
					clientId: 'block-1',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				initialBlocks,
				null
			);

			const updatedBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Updated content' },
					innerBlocks: [],
					clientId: 'block-1',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				updatedBlocks,
				null
			);

			expect( rootBlockIds.length ).toBe( 1 );
			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );
			const content = (
				block.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( content.toString() ).toBe( 'Updated content' );
		} );

		it( 'deletes blocks that are removed', () => {
			const initialBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Block 1' },
					innerBlocks: [],
					clientId: 'block-1',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'Block 2' },
					innerBlocks: [],
					clientId: 'block-2',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				initialBlocks,
				null
			);
			expect( rootBlockIds.length ).toBe( 2 );

			const updatedBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Block 1' },
					innerBlocks: [],
					clientId: 'block-1',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				updatedBlocks,
				null
			);

			expect( rootBlockIds.length ).toBe( 1 );
			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );
			const content = (
				block.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( content.toString() ).toBe( 'Block 1' );
		} );

		it( 'handles innerBlocks recursively', () => {
			const blocksWithInner: Block[] = [
				{
					name: 'core/group',
					attributes: {},
					innerBlocks: [
						{
							name: 'core/paragraph',
							attributes: { content: 'Inner paragraph' },
							innerBlocks: [],
						},
					],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				blocksWithInner,
				null
			);

			expect( rootBlockIds.length ).toBe( 1 );
			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );

			const innerBlockIds = block.get(
				'innerBlockIds'
			) as Y.Array< string >;
			expect( innerBlockIds.length ).toBe( 1 );
			const innerBlockId = innerBlockIds.get( 0 );
			const innerBlock = getBlockById( innerBlockId );
			expect( innerBlock.get( 'name' ) ).toBe( 'core/paragraph' );
		} );

		it( 'skips gallery blocks with unuploaded images (blob attributes)', () => {
			const galleryWithBlobs: Block[] = [
				{
					name: 'core/gallery',
					attributes: {},
					innerBlocks: [
						{
							name: 'core/image',
							attributes: {
								url: 'http://example.com/image.jpg',
								blob: 'blob:...',
							},
							innerBlocks: [],
						},
					],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				galleryWithBlobs,
				null
			);

			// Gallery block should not be synced because it has blob attributes
			expect( rootBlockIds.length ).toBe( 0 );
		} );

		it( 'syncs gallery blocks without blob attributes', () => {
			const galleryWithoutBlobs: Block[] = [
				{
					name: 'core/gallery',
					attributes: {},
					innerBlocks: [
						{
							name: 'core/image',
							attributes: {
								url: 'http://example.com/image.jpg',
							},
							innerBlocks: [],
						},
					],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				galleryWithoutBlobs,
				null
			);

			expect( rootBlockIds.length ).toBe( 1 );
			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );
			expect( block.get( 'name' ) ).toBe( 'core/gallery' );
		} );

		it( 'skips freeform blocks without a content attribute', () => {
			const blocks: Block[] = [
				{
					name: 'core/freeform',
					attributes: {},
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, blocks, null );

			// Freeform block should not be synced because it has no content attribute.
			expect( rootBlockIds.length ).toBe( 0 );
		} );

		it( 'syncs freeform blocks with defined content attribute', () => {
			const blocks: Block[] = [
				{
					name: 'core/freeform',
					attributes: {
						content: 'Some freeform content',
					},
					innerBlocks: [],
				},
				{
					name: 'core/freeform',
					attributes: {
						content: '',
					},
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, blocks, null );

			expect( rootBlockIds.length ).toBe( 2 );
			const blockId0 = rootBlockIds.get( 0 );
			const block0 = getBlockById( blockId0 );
			expect( block0.get( 'name' ) ).toBe( 'core/freeform' );
			expect(
				( block0.get( 'attributes' ) as YBlockAttributes ).get(
					'content'
				)
			).toBe( 'Some freeform content' );

			const blockId1 = rootBlockIds.get( 1 );
			const block1 = getBlockById( blockId1 );
			expect( block1.get( 'name' ) ).toBe( 'core/freeform' );
			expect(
				( block1.get( 'attributes' ) as YBlockAttributes ).get(
					'content'
				)
			).toBe( '' );
		} );

		it( 'handles block reordering', () => {
			const initialBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'First' },
					innerBlocks: [],
					clientId: 'block-1',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'Second' },
					innerBlocks: [],
					clientId: 'block-2',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				initialBlocks,
				null
			);

			// Reorder blocks
			const reorderedBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Second' },
					innerBlocks: [],
					clientId: 'block-2',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'First' },
					innerBlocks: [],
					clientId: 'block-1',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				reorderedBlocks,
				null
			);

			expect( rootBlockIds.length ).toBe( 2 );
			const blockId0 = rootBlockIds.get( 0 );
			const block0 = getBlockById( blockId0 );
			const content0 = (
				block0.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( content0.toString() ).toBe( 'Second' );

			const blockId1 = rootBlockIds.get( 1 );
			const block1 = getBlockById( blockId1 );
			const content1 = (
				block1.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( content1.toString() ).toBe( 'First' );
		} );

		it( 'creates Y.Text for rich-text attributes', () => {
			const blocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Rich text content' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, blocks, null );

			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );
			const contentAttr = (
				block.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( contentAttr ).toBeInstanceOf( Y.Text );
			expect( contentAttr.toString() ).toBe( 'Rich text content' );
		} );

		it( 'creates Y.Text for rich-text attributes even when the block name changes', () => {
			const blocks: Block[] = [
				{
					name: 'core/freeform',
					attributes: { content: 'Freeform text' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, blocks, null );

			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );
			const contentAttr = (
				block.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' );
			expect( block.get( 'name' ) ).toBe( 'core/freeform' );
			expect( typeof contentAttr ).toBe( 'string' );
			expect( contentAttr ).toBe( 'Freeform text' );

			const updatedBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Updated text' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				updatedBlocks,
				null
			);

			expect( rootBlockIds.length ).toBe( 1 );

			const updatedBlockId = rootBlockIds.get( 0 );
			const updatedBlock = getBlockById( updatedBlockId );
			const updatedContentAttr = (
				updatedBlock.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( updatedBlock.get( 'name' ) ).toBe( 'core/paragraph' );
			expect( updatedContentAttr ).toBeInstanceOf( Y.Text );
			expect( updatedContentAttr.toString() ).toBe( 'Updated text' );
		} );

		it( 'removes duplicate clientIds', () => {
			const blocksWithDuplicateIds: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'First' },
					innerBlocks: [],
					clientId: 'duplicate-id',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'Second' },
					innerBlocks: [],
					clientId: 'duplicate-id',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				blocksWithDuplicateIds,
				null
			);

			const blockId0 = rootBlockIds.get( 0 );
			const block0 = getBlockById( blockId0 );
			const clientId1 = block0.get( 'clientId' );
			const blockId1 = rootBlockIds.get( 1 );
			const block1 = getBlockById( blockId1 );
			const clientId2 = block1.get( 'clientId' );

			expect( clientId1 ).not.toBe( clientId2 );
		} );

		it( 'handles attribute deletion', () => {
			const initialBlocks: Block[] = [
				{
					name: 'core/heading',
					attributes: {
						content: 'Heading',
						level: 2,
					},
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				initialBlocks,
				null
			);

			const updatedBlocks: Block[] = [
				{
					name: 'core/heading',
					attributes: {
						content: 'Heading',
					},
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				updatedBlocks,
				null
			);

			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );
			const attributes = block.get( 'attributes' ) as YBlockAttributes;
			expect( attributes.has( 'level' ) ).toBe( false );
			expect( attributes.has( 'content' ) ).toBe( true );
		} );

		it( 'preserves blocks that match from both left and right', () => {
			const initialBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'First' },
					innerBlocks: [],
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'Middle' },
					innerBlocks: [],
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'Last' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				initialBlocks,
				null
			);

			// Update only the middle block
			const updatedBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'First' },
					innerBlocks: [],
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'Updated Middle' },
					innerBlocks: [],
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'Last' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				updatedBlocks,
				null
			);

			expect( rootBlockIds.length ).toBe( 3 );
			const blockId = rootBlockIds.get( 1 );
			const block = getBlockById( blockId );
			const content = (
				block.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( content.toString() ).toBe( 'Updated Middle' );
		} );

		it( 'adds new rich-text attribute to existing block without that attribute', () => {
			// Start with a block that has NO content attribute
			const initialBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { level: 1 },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				initialBlocks,
				null
			);

			// Now add the content attribute (rich-text)
			const updatedBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: {
						level: 1,
						content: 'New content added',
					},
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				updatedBlocks,
				null
			);

			expect( rootBlockIds.length ).toBe( 1 );
			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );
			const attributes = block.get( 'attributes' ) as YBlockAttributes;

			// The content attribute should now exist
			expect( attributes.has( 'content' ) ).toBe( true );
			const content = attributes.get( 'content' ) as Y.Text;
			expect( content.toString() ).toBe( 'New content added' );

			// The level attribute should still exist
			expect( attributes.get( 'level' ) ).toBe( 1 );
		} );

		it( 'handles block type changes from non-rich-text to rich-text', () => {
			// Start with freeform block (content is non-rich-text)
			const freeformBlocks: Block[] = [
				{
					name: 'core/freeform',
					attributes: { content: 'Freeform content' },
					innerBlocks: [],
					clientId: 'block-1',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				freeformBlocks,
				null
			);

			const blockId1 = rootBlockIds.get( 0 );
			const block1 = getBlockById( blockId1 );
			const content1 = (
				block1.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' );
			expect( block1.get( 'name' ) ).toBe( 'core/freeform' );
			expect( typeof content1 ).toBe( 'string' );
			expect( content1 ).toBe( 'Freeform content' );

			// Change to paragraph block (content becomes rich-text)
			const paragraphBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Freeform content' },
					innerBlocks: [],
					clientId: 'block-1',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				paragraphBlocks,
				null
			);

			expect( rootBlockIds.length ).toBe( 1 );
			const blockId2 = rootBlockIds.get( 0 );
			const block2 = getBlockById( blockId2 );
			const content2 = (
				block2.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( block2.get( 'name' ) ).toBe( 'core/paragraph' );
			expect( content2 ).toBeInstanceOf( Y.Text );
			expect( content2.toString() ).toBe( 'Freeform content' );
		} );

		it( 'syncs nested blocks with blob attributes', () => {
			const nestedGallery: Block[] = [
				{
					name: 'core/group',
					attributes: {},
					innerBlocks: [
						{
							name: 'core/gallery',
							attributes: {},
							innerBlocks: [
								{
									name: 'core/image',
									attributes: {
										url: 'http://example.com/image.jpg',
										blob: 'blob:...',
									},
									innerBlocks: [],
								},
							],
						},
					],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				nestedGallery,
				null
			);

			expect( rootBlockIds.length ).toBe( 1 );
			const blockId = rootBlockIds.get( 0 );
			const groupBlock = getBlockById( blockId );
			expect( groupBlock.get( 'name' ) ).toBe( 'core/group' );

			const innerBlockIds = groupBlock.get(
				'innerBlockIds'
			) as Y.Array< string >;
			expect( innerBlockIds.length ).toBe( 1 );
			const innerBlockId = innerBlockIds.get( 0 );
			const innerBlock = getBlockById( innerBlockId );
			expect( innerBlock.get( 'name' ) ).toBe( 'core/gallery' );
		} );

		it( 'handles complex block reordering', () => {
			const initialBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'A' },
					innerBlocks: [],
					clientId: 'block-a',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'B' },
					innerBlocks: [],
					clientId: 'block-b',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'C' },
					innerBlocks: [],
					clientId: 'block-c',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'D' },
					innerBlocks: [],
					clientId: 'block-d',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'E' },
					innerBlocks: [],
					clientId: 'block-e',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				initialBlocks,
				null
			);
			expect( rootBlockIds.length ).toBe( 5 );

			// Reorder: [A, B, C, D, E] -> [C, A, E, B, D]
			const reorderedBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'C' },
					innerBlocks: [],
					clientId: 'block-c',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'A' },
					innerBlocks: [],
					clientId: 'block-a',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'E' },
					innerBlocks: [],
					clientId: 'block-e',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'B' },
					innerBlocks: [],
					clientId: 'block-b',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'D' },
					innerBlocks: [],
					clientId: 'block-d',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				reorderedBlocks,
				null
			);

			expect( rootBlockIds.length ).toBe( 5 );
			const contents = [ 'C', 'A', 'E', 'B', 'D' ];
			contents.forEach( ( expectedContent, i ) => {
				const blockId = rootBlockIds.get( i );
				const block = getBlockById( blockId );
				const content = (
					block.get( 'attributes' ) as YBlockAttributes
				 ).get( 'content' ) as Y.Text;
				expect( content.toString() ).toBe( expectedContent );
			} );
		} );

		it( 'handles many deletions (10 blocks to 2 blocks)', () => {
			const manyBlocks: Block[] = Array.from(
				{ length: 10 },
				( _, i ) => ( {
					name: 'core/paragraph',
					attributes: { content: `Block ${ i }` },
					innerBlocks: [],
					clientId: `block-${ i }`,
				} )
			);

			mergeCrdtBlocks( rootBlockIds, blockProperties, manyBlocks, null );
			expect( rootBlockIds.length ).toBe( 10 );

			const fewBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Block 0' },
					innerBlocks: [],
					clientId: 'block-0',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'Block 9' },
					innerBlocks: [],
					clientId: 'block-9',
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, fewBlocks, null );

			expect( rootBlockIds.length ).toBe( 2 );
			const blockId0 = rootBlockIds.get( 0 );
			const block0 = getBlockById( blockId0 );
			const content0 = (
				block0.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( content0.toString() ).toBe( 'Block 0' );
			const blockId1 = rootBlockIds.get( 1 );
			const block1 = getBlockById( blockId1 );
			const content1 = (
				block1.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( content1.toString() ).toBe( 'Block 9' );
		} );

		it( 'handles many insertions (2 blocks to 10 blocks)', () => {
			const fewBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Block 0' },
					innerBlocks: [],
					clientId: 'block-0',
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'Block 9' },
					innerBlocks: [],
					clientId: 'block-9',
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, fewBlocks, null );
			expect( rootBlockIds.length ).toBe( 2 );

			const manyBlocks: Block[] = Array.from(
				{ length: 10 },
				( _, i ) => ( {
					name: 'core/paragraph',
					attributes: { content: `Block ${ i }` },
					innerBlocks: [],
					clientId: `block-${ i }`,
				} )
			);

			mergeCrdtBlocks( rootBlockIds, blockProperties, manyBlocks, null );

			expect( rootBlockIds.length ).toBe( 10 );
			manyBlocks.forEach( ( block, i ) => {
				const blockId = rootBlockIds.get( i );
				const yblock = getBlockById( blockId );
				const content = (
					yblock.get( 'attributes' ) as YBlockAttributes
				 ).get( 'content' ) as Y.Text;
				expect( content.toString() ).toBe( `Block ${ i }` );
			} );
		} );

		it( 'handles changes with all different block content', () => {
			const blocksA: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'A1' },
					innerBlocks: [],
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'A2' },
					innerBlocks: [],
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'A3' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, blocksA, null );
			expect( rootBlockIds.length ).toBe( 3 );

			const blocksB: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'B1' },
					innerBlocks: [],
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'B2' },
					innerBlocks: [],
				},
				{
					name: 'core/paragraph',
					attributes: { content: 'B3' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, blocksB, null );

			expect( rootBlockIds.length ).toBe( 3 );
			[ 'B1', 'B2', 'B3' ].forEach( ( expected, i ) => {
				const blockId = rootBlockIds.get( i );
				const block = getBlockById( blockId );
				const content = (
					block.get( 'attributes' ) as YBlockAttributes
				 ).get( 'content' ) as Y.Text;
				expect( content.toString() ).toBe( expected );
			} );
		} );

		it( 'clears all blocks when syncing empty array', () => {
			const blocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Content' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, blocks, null );
			expect( rootBlockIds.length ).toBe( 1 );

			mergeCrdtBlocks( rootBlockIds, blockProperties, [], null );
			expect( rootBlockIds.length ).toBe( 0 );
		} );

		it( 'handles deeply nested blocks', () => {
			const deeplyNested: Block[] = [
				{
					name: 'core/group',
					attributes: {},
					innerBlocks: [
						{
							name: 'core/group',
							attributes: {},
							innerBlocks: [
								{
									name: 'core/group',
									attributes: {},
									innerBlocks: [
										{
											name: 'core/group',
											attributes: {},
											innerBlocks: [
												{
													name: 'core/paragraph',
													attributes: {
														content: 'Deep content',
													},
													innerBlocks: [],
												},
											],
										},
									],
								},
							],
						},
					],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				deeplyNested,
				null
			);

			// Navigate to the deepest block
			let currentIds: Y.Array< string > = rootBlockIds;
			for ( let i = 0; i < 4; i++ ) {
				expect( currentIds.length ).toBe( 1 );
				const blockId = currentIds.get( 0 );
				const block = getBlockById( blockId );
				currentIds = block.get( 'innerBlockIds' ) as Y.Array< string >;
			}

			expect( currentIds.length ).toBe( 1 );
			const deepBlockId = currentIds.get( 0 );
			const deepBlock = getBlockById( deepBlockId );
			const content = (
				deepBlock.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( content.toString() ).toBe( 'Deep content' );

			// Update innermost block
			const updatedDeep: Block[] = [
				{
					name: 'core/group',
					attributes: {},
					innerBlocks: [
						{
							name: 'core/group',
							attributes: {},
							innerBlocks: [
								{
									name: 'core/group',
									attributes: {},
									innerBlocks: [
										{
											name: 'core/group',
											attributes: {},
											innerBlocks: [
												{
													name: 'core/paragraph',
													attributes: {
														content: 'Updated deep',
													},
													innerBlocks: [],
												},
											],
										},
									],
								},
							],
						},
					],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, updatedDeep, null );

			// Verify update propagated
			currentIds = rootBlockIds;
			for ( let i = 0; i < 4; i++ ) {
				const blockId = currentIds.get( 0 );
				const block = getBlockById( blockId );
				currentIds = block.get( 'innerBlockIds' ) as Y.Array< string >;
			}

			const updatedBlockId = currentIds.get( 0 );
			const updatedBlock = getBlockById( updatedBlockId );
			const updatedContent = (
				updatedBlock.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;

			expect( updatedContent.toString() ).toBe( 'Updated deep' );
		} );

		it( 'removes duplicate clientIds across different nesting levels', () => {
			const blocksWithCrossLevelDuplicates: Block[] = [
				{
					name: 'core/group',
					attributes: {},
					innerBlocks: [
						{
							name: 'core/paragraph',
							attributes: { content: 'Nested' },
							innerBlocks: [],
							clientId: 'duplicate-id',
						},
					],
					clientId: 'duplicate-id',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				blocksWithCrossLevelDuplicates,
				null
			);

			expect( rootBlockIds.length ).toBe( 1 );
			const rootBlockId = rootBlockIds.get( 0 );
			const rootBlock = getBlockById( rootBlockId );
			const rootClientId = rootBlock.get( 'clientId' );

			const innerBlockIds = rootBlock.get(
				'innerBlockIds'
			) as Y.Array< string >;
			const nestedBlockId = innerBlockIds.get( 0 );
			const nestedBlock = getBlockById( nestedBlockId );
			const nestedClientId = nestedBlock.get( 'clientId' );

			// Cross-level duplicates should be removed
			expect( rootClientId ).toBe( 'duplicate-id' );
			expect( nestedClientId ).not.toBe( 'duplicate-id' );
			expect( nestedClientId ).toBeDefined();
		} );

		it( 'handles null and undefined attribute values', () => {
			const blocksWithNullAttrs: Block[] = [
				{
					name: 'core/paragraph',
					attributes: {
						content: 'Content',
						customAttr: null,
						otherAttr: undefined,
					},
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				blocksWithNullAttrs,
				null
			);

			expect( rootBlockIds.length ).toBe( 1 );
			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );
			const attributes = block.get( 'attributes' ) as YBlockAttributes;
			expect( attributes.get( 'content' ) ).toBeInstanceOf( Y.Text );
			expect( attributes.get( 'customAttr' ) ).toBe( null );
		} );

		it( 'handles rich-text updates with cursor at start', () => {
			const blocks: Block[] = [
				{
					clientId: 'block-1',
					name: 'core/paragraph',
					attributes: { content: 'Hello World' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, blocks, null );

			const updatedBlocks: Block[] = [
				{
					clientId: 'block-1',
					name: 'core/paragraph',
					attributes: { content: 'XHello World' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, updatedBlocks, 0 );

			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );
			const content = (
				block.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( content.toString() ).toBe( 'XHello World' );
		} );

		it( 'handles rich-text updates with cursor at end', () => {
			const blocks: Block[] = [
				{
					clientId: 'block-2',
					name: 'core/paragraph',
					attributes: { content: 'Hello World' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, blocks, null );

			const updatedBlocks: Block[] = [
				{
					clientId: 'block-2',
					name: 'core/paragraph',
					attributes: { content: 'Hello World!' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, updatedBlocks, 11 );

			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );
			const content = (
				block.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( content.toString() ).toBe( 'Hello World!' );
		} );

		it( 'handles rich-text updates with cursor beyond text length', () => {
			const blocks: Block[] = [
				{
					clientId: 'block-3',
					name: 'core/paragraph',
					attributes: { content: 'Hello' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks( rootBlockIds, blockProperties, blocks, null );

			const updatedBlocks: Block[] = [
				{
					clientId: 'block-3',
					name: 'core/paragraph',
					attributes: { content: 'Hello World' },
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				updatedBlocks,
				999
			);

			const blockId = rootBlockIds.get( 0 );
			const block = getBlockById( blockId );
			const content = (
				block.get( 'attributes' ) as YBlockAttributes
			 ).get( 'content' ) as Y.Text;
			expect( content.toString() ).toBe( 'Hello World' );
		} );

		it( 'deletes extra block properties not in incoming blocks', () => {
			const initialBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Content' },
					innerBlocks: [],
					clientId: 'block-1',
					isValid: true,
					originalContent: 'Original',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				initialBlocks,
				null
			);

			const blockId1 = rootBlockIds.get( 0 );
			const block1 = getBlockById( blockId1 );
			expect( block1.get( 'isValid' ) ).toBe( true );
			expect( block1.get( 'originalContent' ) ).toBe( 'Original' );

			const updatedBlocks: Block[] = [
				{
					name: 'core/paragraph',
					attributes: { content: 'Content' },
					innerBlocks: [],
					clientId: 'block-1',
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				updatedBlocks,
				null
			);

			const blockId2 = rootBlockIds.get( 0 );
			const block2 = getBlockById( blockId2 );
			expect( block2.has( 'isValid' ) ).toBe( false );
			expect( block2.has( 'originalContent' ) ).toBe( false );
		} );

		it( 'deletes rich-text attributes when removed from block', () => {
			const blocksWithRichText: Block[] = [
				{
					clientId: 'block-4',
					name: 'core/paragraph',
					attributes: {
						content: 'Rich text content',
						caption: 'Caption text',
					},
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				blocksWithRichText,
				null
			);

			const blockId1 = rootBlockIds.get( 0 );
			const block1 = getBlockById( blockId1 );
			const attrs1 = block1.get( 'attributes' ) as YBlockAttributes;
			expect( attrs1.has( 'content' ) ).toBe( true );
			expect( attrs1.has( 'caption' ) ).toBe( true );

			const blocksWithoutCaption: Block[] = [
				{
					name: 'core/paragraph',
					attributes: {
						content: 'Rich text content',
					},
					innerBlocks: [],
				},
			];

			mergeCrdtBlocks(
				rootBlockIds,
				blockProperties,
				blocksWithoutCaption,
				null
			);

			const blockId2 = rootBlockIds.get( 0 );
			const block2 = getBlockById( blockId2 );
			const attrs2 = block2.get( 'attributes' ) as YBlockAttributes;
			expect( attrs2.has( 'content' ) ).toBe( true );
			expect( attrs2.has( 'caption' ) ).toBe( false );
		} );
	} );
} );
