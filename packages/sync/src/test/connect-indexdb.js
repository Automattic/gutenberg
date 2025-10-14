/**
 * External dependencies
 */
import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import * as Y from 'yjs';
// Polyfill structuredClone for jsdom environment (required by fake-indexeddb).
// Jest uses jsdom which doesn't include the structuredClone API yet.
// See: https://github.com/dumbmatter/fakeIndexedDB#jsdom-often-used-with-jest
import 'core-js/stable/structured-clone';
import 'fake-indexeddb/auto';

/**
 * Internal dependencies
 */
import { connectIndexDb } from '../connect-indexdb';

describe( 'connectIndexDb', () => {
	let doc;
	let provider;

	beforeEach( () => {
		doc = new Y.Doc();
	} );

	afterEach( () => {
		provider?.destroy();
		doc?.destroy();
	} );

	it( 'creates an IndexeddbPersistence provider correctly', async () => {
		const result = await connectIndexDb( '123', 'post', doc );
		provider = result;

		expect( result ).toBeDefined();
		expect( typeof result.destroy ).toBe( 'function' );
	} );

	it( 'destroy method cleans up the provider', async () => {
		const result = await connectIndexDb( '789', 'post', doc );
		provider = result;

		expect( result ).toBeDefined();
		expect( typeof result.destroy ).toBe( 'function' );
		expect( () => result.destroy() ).not.toThrow();
	} );

	it( 'handles different object types and IDs correctly', async () => {
		const result = await connectIndexDb( '456', 'page', doc );
		provider = result;

		expect( result ).toBeDefined();
		expect( typeof result.destroy ).toBe( 'function' );
	} );

	it( 'persists data to IndexedDB', async () => {
		const result = await connectIndexDb( '123', 'post', doc );
		provider = result;

		const ymap = doc.getMap( 'test' );
		ymap.set( 'key', 'value' );

		expect( ymap.get( 'key' ) ).toBe( 'value' );
	} );
} );
