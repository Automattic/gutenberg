/**
 * External dependencies
 */
import { v4 as uuidv4 } from 'uuid';
import fastDeepEqual from 'fast-deep-equal/es6';

/**
 * WordPress dependencies
 */
// @ts-ignore No types exported
import { getBlockTypes } from '@wordpress/blocks';
import { RichTextData } from '@wordpress/rich-text';
import { Y, Delta } from '@wordpress/sync';

/**
 * Internal dependencies
 */
import { createYMap, type YMapRecord, type YMapWrap } from './crdt-utils';

interface BlockAttributes {
	[ key: string ]: unknown;
}

interface BlockType {
	name: string;
	attributes?: Record< string, { type?: string } >;
}

// A block as represented in Gutenberg's data store.
export interface Block {
	attributes: BlockAttributes;
	clientId?: string;
	innerBlocks: Block[];
	isValid?: boolean;
	name: string;
	originalContent?: string;
	validationIssues?: string[]; // unserializable
}

// A block as represented in the CRDT document (Y.Map).
interface YBlockRecord extends YMapRecord {
	attributes: YBlockAttributes;
	clientId: string;
	innerBlocks: Y.Array< string >;
	isValid?: boolean;
	originalContent?: string;
	name: string;
}

export type YBlock = YMapWrap< YBlockRecord >;

// Keys are clientIds, values are YBlocks.
export type YBlockProperties = Y.Map< YBlock >;

// Block attribute schema cannot be known at compile time, so we use Y.Map.
// Attribute values will be typed as the union of `Y.Text` and `unknown`.
export type YBlockAttributes = Y.Map< Y.Text | unknown >;

const serializableBlocksCache = new WeakMap< WeakKey, Block[] >();

function makeBlockAttributesSerializable(
	attributes: BlockAttributes
): BlockAttributes {
	const newAttributes = { ...attributes };
	for ( const [ key, value ] of Object.entries( attributes ) ) {
		if ( value instanceof RichTextData ) {
			newAttributes[ key ] = value.valueOf();
		}
	}
	return newAttributes;
}

function makeBlocksSerializable( blocks: Block[] ): Block[] {
	return blocks.map( ( block: Block ) => {
		const { name, innerBlocks, attributes, ...rest } = block;
		delete rest.validationIssues;
		return {
			...rest,
			name,
			attributes: makeBlockAttributesSerializable( attributes ),
			innerBlocks: makeBlocksSerializable( innerBlocks ),
		};
	} );
}

/**
 * @param {any}   gblock
 * @param {Y.Map} yblock
 */
function areBlocksEqual( gblock: Block, yblock: YBlock ): boolean {
	// we must not sync clientId, as this can't be generated consistently and
	// hence will lead to merge conflicts.
	const overwrites = {
		innerBlocks: null,
		clientId: null,
	};
	const inners = gblock.innerBlocks || [];
	const yinners = yblock.get( 'innerBlocks' );

	// Check if innerBlocks count matches
	if ( inners.length !== yinners?.length ) {
		return false;
	}

	const yblockAsJson = yblock.toJSON();

	const fastEqualCheck = fastDeepEqual(
		Object.assign( {}, gblock, overwrites ),
		Object.assign( {}, yblockAsJson, overwrites )
	);

	// For flat structure, yinners is an array of clientIds (strings)
	// We need to check if clientIds match in order
	return (
		fastEqualCheck &&
		inners.every( ( block: Block, i: number ) => {
			const yInnerClientId = yinners.get( i );
			return block.clientId === yInnerClientId;
		} )
	);
}

function createNewYAttributeMap(
	blockName: string,
	attributes: BlockAttributes
): YBlockAttributes {
	return new Y.Map(
		Object.entries( attributes ).map(
			( [ attributeName, attributeValue ] ) => {
				return [
					attributeName,
					createNewYAttributeValue(
						blockName,
						attributeName,
						attributeValue
					),
				];
			}
		)
	);
}

function createNewYAttributeValue(
	blockName: string,
	attributeName: string,
	attributeValue: unknown
): Y.Text | unknown {
	const isRichText = isRichTextAttribute( blockName, attributeName );

	if ( isRichText ) {
		return new Y.Text( attributeValue?.toString() ?? '' );
	}

	return attributeValue;
}

/**
 * Compare a Block with a YBlock by clientId for equality.
 * @param gblock
 * @param clientId
 * @param blockProperties
 */
function areBlocksEqualByClientId(
	gblock: Block,
	clientId: string,
	blockProperties: YBlockProperties
): boolean {
	const yblock = blockProperties.get( clientId );
	if ( ! yblock ) {
		return false;
	}
	return areBlocksEqual( gblock, yblock );
}

/**
 * Merge incoming block data into the local Y.Doc.
 * This function is called to sync local block changes to a shared Y.Doc.
 *
 * @param rootBlockIds    Root-level block clientIds.
 * @param blockProperties Map of clientId to block properties.
 * @param incomingBlocks  Gutenberg blocks being synced.
 * @param cursorPosition  The position of the cursor after the change occurs.
 */
export function mergeCrdtBlocks(
	rootBlockIds: Y.Array< string >,
	blockProperties: YBlockProperties,
	incomingBlocks: Block[],
	cursorPosition: number | null
): void {
	// Ensure we are working with serializable block data.
	if ( ! serializableBlocksCache.has( incomingBlocks ) ) {
		serializableBlocksCache.set(
			incomingBlocks,
			makeBlocksSerializable( incomingBlocks )
		);
	}
	const allBlocks = serializableBlocksCache.get( incomingBlocks ) ?? [];

	// Ensure we skip blocks that we don't want to sync at the moment
	const blocksToSync = allBlocks.filter( ( block ) =>
		shouldBlockBeSynced( block )
	);

	// Perform the merge
	mergeCrdtBlocksInternal(
		rootBlockIds,
		blockProperties,
		blocksToSync,
		cursorPosition
	);

	// Remove duplicate clientIds across all nesting levels (at top level)
	removeDuplicateClientIds( rootBlockIds, blockProperties );
}

/**
 * Internal function to merge blocks without any top-level checks.
 * Called recursively for innerBlocks.
 *
 * @param rootBlockIds    Root-level block clientIds.
 * @param blockProperties Map of clientId to block properties.
 * @param incomingBlocks  Incoming blocks from Gutenberg to merge.
 * @param cursorPosition  The position of the cursor after the change occurs.
 */
function mergeCrdtBlocksInternal(
	rootBlockIds: Y.Array< string >,
	blockProperties: YBlockProperties,
	incomingBlocks: Block[],
	cursorPosition: number | null
): void {
	// This is a rudimentary diff implementation similar to the y-prosemirror diffing
	// approach, adapted to work with flat block structure.
	//
	// @credit Kevin Jahns (dmonad)
	// @link https://github.com/WordPress/gutenberg/pull/68483
	const numOfCommonEntries = Math.min(
		incomingBlocks.length ?? 0,
		rootBlockIds.length
	);

	let left = 0;
	let right = 0;

	// skip equal blocks from left
	for (
		;
		left < numOfCommonEntries &&
		areBlocksEqualByClientId(
			incomingBlocks[ left ],
			rootBlockIds.get( left ) ?? '',
			blockProperties
		);
		left++
	) {
		/* nop */
	}

	// skip equal blocks from right
	for (
		;
		right < numOfCommonEntries - left &&
		areBlocksEqualByClientId(
			incomingBlocks[ incomingBlocks.length - right - 1 ],
			rootBlockIds.get( rootBlockIds.length - right - 1 ) ?? '',
			blockProperties
		);
		right++
	) {
		/* nop */
	}

	const numOfUpdatesNeeded = numOfCommonEntries - left - right;
	const numOfInsertionsNeeded = Math.max(
		0,
		incomingBlocks.length - rootBlockIds.length
	);
	const numOfDeletionsNeeded = Math.max(
		0,
		rootBlockIds.length - incomingBlocks.length
	);

	// updates
	for ( let i = 0; i < numOfUpdatesNeeded; i++, left++ ) {
		const block = incomingBlocks[ left ];
		const clientId = rootBlockIds.get( left );
		if ( ! clientId ) {
			continue;
		}

		let yblock = blockProperties.get( clientId );
		if ( ! yblock ) {
			// Block doesn't exist in properties, create it
			yblock = createFlatYBlock( block, blockProperties, cursorPosition );
			blockProperties.set( clientId, yblock );
			continue;
		}

		// Update existing block
		Object.entries( block ).forEach( ( [ key, value ] ) => {
			switch ( key ) {
				case 'attributes': {
					const currentAttributes = yblock.get( key );

					// If attributes are not set on the yblock, use the new values.
					if ( ! currentAttributes ) {
						yblock.set(
							key,
							createNewYAttributeMap( block.name, value )
						);
						break;
					}

					Object.entries( value ).forEach(
						( [ attributeName, attributeValue ] ) => {
							if (
								fastDeepEqual(
									currentAttributes?.get( attributeName ),
									attributeValue
								)
							) {
								return;
							}

							const currentAttribute =
								currentAttributes.get( attributeName );
							const isRichText = isRichTextAttribute(
								block.name,
								attributeName
							);

							const attributeHasTypeChange =
								( isRichText &&
									! (
										currentAttribute instanceof Y.Text
									) ) ||
								( ! isRichText &&
									currentAttribute instanceof Y.Text );

							// Skip update if values are equal and type stays the same
							if (
								! attributeHasTypeChange &&
								fastDeepEqual(
									currentAttribute,
									attributeValue
								)
							) {
								return;
							}

							if (
								isRichText &&
								'string' === typeof attributeValue &&
								currentAttributes.has( attributeName ) &&
								currentAttribute instanceof Y.Text
							) {
								// Rich text values are stored as persistent Y.Text instances.
								// Update the value with a delta in place.
								mergeRichTextUpdate(
									currentAttribute,
									attributeValue,
									cursorPosition
								);
							} else {
								currentAttributes.set(
									attributeName,
									createNewYAttributeValue(
										block.name,
										attributeName,
										attributeValue
									)
								);
							}
						}
					);

					// Delete any attributes that are no longer present.
					currentAttributes.forEach(
						( _attrValue: unknown, attrName: string ) => {
							if ( ! value.hasOwnProperty( attrName ) ) {
								currentAttributes.delete( attrName );
							}
						}
					);

					break;
				}

				case 'innerBlocks': {
					// Recursively merge innerBlocks
					let yInnerBlockIds = yblock.get( 'innerBlocks' );

					if ( ! ( yInnerBlockIds instanceof Y.Array ) ) {
						yInnerBlockIds = new Y.Array< string >();
						yblock.set( 'innerBlocks', yInnerBlockIds );
					}

					mergeCrdtBlocksInternal(
						rootBlockIds,
						blockProperties,
						value ?? [],
						cursorPosition
					);
					break;
				}

				default:
					if ( ! fastDeepEqual( block[ key ], yblock.get( key ) ) ) {
						yblock.set( key, value );
					}
			}
		} );

		yblock.forEach( ( _v, k ) => {
			if ( ! block.hasOwnProperty( k ) ) {
				yblock.delete( k );
			}
		} );
	}

	// deletes
	const deletedIds: string[] = [];
	for ( let i = 0; i < numOfDeletionsNeeded; i++ ) {
		const deletedId = rootBlockIds.get( left + i );
		if ( deletedId ) {
			deletedIds.push( deletedId );
		}
	}
	rootBlockIds.delete( left, numOfDeletionsNeeded );

	// Remove deleted blocks and their descendants from blockProperties
	deletedIds.forEach( ( id ) =>
		deleteBlockAndDescendants( id, blockProperties )
	);

	// inserts
	for ( let i = 0; i < numOfInsertionsNeeded; i++, left++ ) {
		const block = incomingBlocks[ left ];
		const clientId = block.clientId ?? uuidv4();

		// Create flat block and all its descendants
		const yblock = createFlatYBlock(
			block,
			blockProperties,
			cursorPosition
		);
		blockProperties.set( clientId, yblock );

		// Insert clientId into the array
		rootBlockIds.insert( left, [ clientId ] );
	}
}

/**
 * Recursively remove duplicate clientIds from blocks and their innerBlocks.
 *
 * @param blockIds        Array of block clientIds to check.
 * @param blockProperties Map of clientId to block properties.
 * @param knownClientIds  Set of clientIds seen so far.
 */
function removeDuplicateClientIds(
	blockIds: Y.Array< string >,
	blockProperties: YBlockProperties,
	knownClientIds: Set< string > = new Set()
): void {
	for ( let j = 0; j < blockIds.length; j++ ) {
		let clientId = blockIds.get( j );
		const yblock = clientId ? blockProperties.get( clientId ) : false;

		if ( clientId && yblock ) {
			if ( knownClientIds.has( clientId ) ) {
				clientId = uuidv4();
				yblock.set( 'clientId', clientId );
			}

			knownClientIds.add( clientId );
		}

		// Recursively check innerBlocks client IDs
		const yInnerBlocks = yblock ? yblock.get( 'innerBlocks' ) : false;

		if ( yInnerBlocks && yInnerBlocks instanceof Y.Array ) {
			removeDuplicateClientIds(
				yInnerBlocks,
				blockProperties,
				knownClientIds
			);
		}
	}
}

/**
 * Create a flat YBlock from a Block, including all descendants.
 * @param block
 * @param blockProperties
 * @param cursorPosition
 */
function createFlatYBlock(
	block: Block,
	blockProperties: YBlockProperties,
	cursorPosition: number | null
): YBlock {
	const clientId = block.clientId ?? uuidv4();

	// Create innerBlocks array of clientIds
	const innerBlockIds = new Y.Array< string >();
	if ( block.innerBlocks && block.innerBlocks.length > 0 ) {
		const ids: string[] = [];
		block.innerBlocks.forEach( ( innerBlock ) => {
			const innerId = innerBlock.clientId ?? uuidv4();
			ids.push( innerId );
			// Recursively create inner blocks
			const innerYBlock = createFlatYBlock(
				innerBlock,
				blockProperties,
				cursorPosition
			);
			blockProperties.set( innerId, innerYBlock );
		} );
		innerBlockIds.insert( 0, ids );
	}

	return createYMap< YBlockRecord >( {
		clientId,
		name: block.name,
		attributes: createNewYAttributeMap( block.name, block.attributes ),
		innerBlocks: innerBlockIds,
		isValid: block.isValid,
		originalContent: block.originalContent,
	} );
}

/**
 * Delete a block and all its descendants from blockProperties.
 * @param clientId
 * @param blockProperties
 */
function deleteBlockAndDescendants(
	clientId: string,
	blockProperties: YBlockProperties
): void {
	const yblock = blockProperties.get( clientId );
	if ( ! yblock ) {
		return;
	}

	// Recursively delete inner blocks
	const innerBlockIds = yblock.get( 'innerBlocks' );
	if ( innerBlockIds && innerBlockIds.length > 0 ) {
		for ( let i = 0; i < innerBlockIds.length; i++ ) {
			const innerId = innerBlockIds.get( i );
			if ( innerId ) {
				deleteBlockAndDescendants( innerId, blockProperties );
			}
		}
	}

	// Delete this block
	blockProperties.delete( clientId );
}

/**
 * Determine if a block should be synced.
 *
 * Ex: A gallery block should not be synced until the images have been
 * uploaded to WordPress, and their url is available. Before that,
 * it's not possible to access the blobs on a client as those are
 * local.
 *
 * @param block The block to check.
 * @return True if the block should be synced, false otherwise.
 */
function shouldBlockBeSynced( block: Block ): boolean {
	switch ( block.name ) {
		case 'core/freeform': {
			// A freeform block without a content attribute will trigger an open modal
			// in all peers, which we want to prevent.
			return 'string' === typeof block.attributes.content;
		}

		case 'core/gallery': {
			// Verify that all images have had their blobs converted to full URLs so
			// that other peers can render them correctly.
			return ! block.innerBlocks.some(
				( innerBlock ) =>
					innerBlock.attributes && innerBlock.attributes.blob
			);
		}
	}

	// Allow all other blocks to be synced.
	return true;
}

// Cache rich-text attributes for all block types.
let cachedRichTextAttributes: Map< string, Map< string, true > >;

/**
 * Given a block name and attribute key, return true if the attribute is rich-text typed.
 *
 * @param blockName     The name of the block, e.g. 'core/paragraph'.
 * @param attributeName The name of the attribute to check, e.g. 'content'.
 * @return True if the attribute is rich-text typed, false otherwise.
 */
function isRichTextAttribute(
	blockName: string,
	attributeName: string
): boolean {
	if ( ! cachedRichTextAttributes ) {
		// Parse the attributes for all blocks once.
		cachedRichTextAttributes = new Map< string, Map< string, true > >();

		for ( const blockType of getBlockTypes() as BlockType[] ) {
			const richTextAttributeMap = new Map< string, true >();

			for ( const [ name, definition ] of Object.entries(
				blockType.attributes ?? {}
			) ) {
				if ( 'rich-text' === definition.type ) {
					richTextAttributeMap.set( name, true );
				}
			}

			cachedRichTextAttributes.set(
				blockType.name,
				richTextAttributeMap
			);
		}
	}

	return (
		cachedRichTextAttributes.get( blockName )?.has( attributeName ) ?? false
	);
}

let localDoc: Y.Doc;

/**
 * Given a Y.Text object and an updated string value, diff the new value and
 * apply the delta to the Y.Text.
 *
 * @param blockYText     The Y.Text to update.
 * @param updatedValue   The updated value.
 * @param cursorPosition The position of the cursor after the change occurs.
 */
function mergeRichTextUpdate(
	blockYText: Y.Text,
	updatedValue: string,
	cursorPosition: number | null
): void {
	// Gutenberg does not use Yjs shared types natively, so we can only subscribe
	// to changes from store and apply them to Yjs types that we create and
	// manage. Crucially, for rich-text attributes, we do not receive granular
	// string updates; we get the new full string value on each change, even when
	// only a single character changed.
	//
	// The code below allows us to compute a delta between the current and new
	// value, then apply it to the Y.Text.

	if ( ! localDoc ) {
		// Y.Text must be attached to a Y.Doc to be able to do operations on it.
		// Create a temporary Y.Text attached to a local Y.Doc for delta computation.
		localDoc = new Y.Doc();
	}

	const localYText = localDoc.getText( 'temporary-text' );
	localYText.delete( 0, localYText.length );
	localYText.insert( 0, updatedValue );

	const currentValueAsDelta = new Delta( blockYText.toDelta() );
	const updatedValueAsDelta = new Delta( localYText.toDelta() );
	const deltaDiff = currentValueAsDelta.diffWithCursor(
		updatedValueAsDelta,
		cursorPosition
	);

	blockYText.applyDelta( deltaDiff.ops );
}
