/**
 * External dependencies
 */
import * as Y from 'yjs';

/**
 * Internal dependencies
 */
import {
	CRDT_DOC_VERSION,
	CRDT_STATE_MAP_KEY,
	CRDT_STATE_PERSISTED_AT_KEY,
	CRDT_STATE_RESTORED_AT_KEY,
	CRDT_STATE_VERSION_KEY,
} from './config';
/**
 * WordPress dependencies
 */
import { doAction } from '@wordpress/hooks';

export function createYjsDoc( documentMeta: Record< string, unknown > ): Y.Doc {
	// Meta is not synced and does not get persisted with the document.
	const metaMap = new Map< string, unknown >(
		Object.entries( documentMeta )
	);

	const ydoc = new Y.Doc( { meta: metaMap } );
	const stateMap = ydoc.getMap( CRDT_STATE_MAP_KEY );

	stateMap.set( CRDT_STATE_PERSISTED_AT_KEY, 0 );
	stateMap.set( CRDT_STATE_RESTORED_AT_KEY, 0 );
	stateMap.set( CRDT_STATE_VERSION_KEY, CRDT_DOC_VERSION );

	return ydoc;
}

export function broadcastYTextInstances(
	blocks: Y.Array< Y.Map< unknown > >
): void {
	console.log( 'Broadcasting Y.Text instances for blocks:', blocks.toJSON() );
	blocks.forEach( ( block ) => {
		const clientId = block.get( 'clientId' ) as string;
		const attributes = block.get( 'attributes' ) as Y.Map< Y.Text | any >;

		attributes.forEach( ( value, _key ) => {
			if ( value instanceof Y.Text ) {
				console.log(
					'Broadcasting Y.Text instance for clientId:',
					clientId
				);
				doAction( 'sync.broadcastYTextInstance', {
					clientId,
					yText: value,
				} );
			}
		} );

		const innerBlocks = block.get( 'innerBlocks' ) as Y.Array<
			Y.Map< unknown >
		>;

		if ( innerBlocks.length > 0 ) {
			broadcastYTextInstances( innerBlocks );
		}
	} );
}
