/**
 * External dependencies
 */
import { describe, expect, it, afterEach } from '@jest/globals';
import * as Y from 'yjs';

/**
 * Internal dependencies
 */
import { createYjsDoc } from '../utils';
import {
	CRDT_DOC_VERSION,
	CRDT_STATE_MAP_KEY,
	CRDT_STATE_PERSISTED_AT_KEY,
	CRDT_STATE_RESTORED_AT_KEY,
	CRDT_STATE_VERSION_KEY,
} from '../config';

describe( 'createYjsDoc', () => {
	let ydoc: Y.Doc;

	afterEach( () => {
		ydoc?.destroy();
	} );

	it( 'initializes state map with default values', () => {
		ydoc = createYjsDoc( { objectType: 'post' } );
		const stateMap = ydoc.getMap( CRDT_STATE_MAP_KEY );

		expect( ydoc ).toBeInstanceOf( Y.Doc );
		expect( stateMap.get( CRDT_STATE_PERSISTED_AT_KEY ) ).toBe( 0 );
		expect( stateMap.get( CRDT_STATE_RESTORED_AT_KEY ) ).toBe( 0 );
		expect( stateMap.get( CRDT_STATE_VERSION_KEY ) ).toBe(
			CRDT_DOC_VERSION
		);
		expect( ydoc.meta?.get( 'objectType' ) ).toBe( 'post' );
	} );

	it( 'sets document meta from provided metadata', () => {
		const documentMeta = {
			objectType: 'post',
			objectId: 123,
			author: 'test-user',
		};

		ydoc = createYjsDoc( documentMeta );

		expect( ydoc.meta?.get( 'objectType' ) ).toBe( 'post' );
		expect( ydoc.meta?.get( 'objectId' ) ).toBe( 123 );
		expect( ydoc.meta?.get( 'author' ) ).toBe( 'test-user' );
	} );
} );
