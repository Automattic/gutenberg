/**
 * External dependencies
 */
import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import * as Y from 'yjs';

/**
 * Internal dependencies
 */
import { UndoManager } from '../undo-manager';
import { YMultiDocUndoManager } from '../y-utilities/y-multidoc-undomanager';

describe( 'UndoManager', () => {
	let undoManager: UndoManager;
	let ydoc: Y.Doc;
	let ymap: Y.Map< any >;

	beforeEach( () => {
		// Reset the singleton instance
		( UndoManager as any ).instance = null;
		ydoc = new Y.Doc();
		ymap = ydoc.getMap( 'test' );
	} );

	afterEach( () => {
		ydoc?.destroy();
	} );

	it( 'creates a singleton instance', () => {
		const instance1 = UndoManager.create();
		const instance2 = UndoManager.create();

		expect( instance1 ).toBe( instance2 );
		expect( instance1 ).toBeInstanceOf( UndoManager );
	} );

	it( 'initializes with YMultiDocUndoManager tracking gutenberg origin', () => {
		const instance = UndoManager.create();
		const internalManager = ( instance as any ).undoManager;

		expect( internalManager ).toBeInstanceOf( YMultiDocUndoManager );
		expect( internalManager.trackedOrigins.has( 'gutenberg' ) ).toBe(
			true
		);
	} );

	it( 'addRecord is a no-op', () => {
		undoManager = UndoManager.create();

		expect( () => undoManager.addRecord() ).not.toThrow();
		expect( () => undoManager.addRecord( undefined, false ) ).not.toThrow();
		expect( () => undoManager.addRecord( undefined, true ) ).not.toThrow();
	} );

	describe( 'addToScope', () => {
		it( 'adds a Yjs map to the undo manager scope', () => {
			undoManager = UndoManager.create();

			undoManager.addToScope( ymap );

			// Verify the map is in scope by checking the internal manager
			const internalManager = ( undoManager as any ).undoManager;
			expect( internalManager.docs.has( ydoc ) ).toBe( true );
		} );

		it( 'can add multiple maps to scope', () => {
			undoManager = UndoManager.create();
			const ydoc2 = new Y.Doc();
			const ymap2 = ydoc2.getMap( 'test2' );

			undoManager.addToScope( ymap );
			undoManager.addToScope( ymap2 );

			const internalManager = ( undoManager as any ).undoManager;
			expect( internalManager.docs.has( ydoc ) ).toBe( true );
			expect( internalManager.docs.has( ydoc2 ) ).toBe( true );

			ydoc2.destroy();
		} );
	} );

	it( 'undo returns undefined when nothing to undo', () => {
		undoManager = UndoManager.create();
		undoManager.addToScope( ymap );

		expect( undoManager.undo() ).toBeUndefined();
	} );

	it( 'undo reverts changes and returns empty array', () => {
		undoManager = UndoManager.create();
		undoManager.addToScope( ymap );

		ydoc.transact( () => {
			ymap.set( 'key1', 'value1' );
		}, 'gutenberg' );

		expect( ymap.get( 'key1' ) ).toBe( 'value1' );
		expect( undoManager.undo() ).toEqual( [] );
		expect( ymap.get( 'key1' ) ).toBeUndefined();
	} );

	it( 'redo returns undefined when nothing to redo', () => {
		undoManager = UndoManager.create();
		undoManager.addToScope( ymap );

		expect( undoManager.redo() ).toBeUndefined();
	} );

	it( 'redo reapplies changes and returns empty array', () => {
		undoManager = UndoManager.create();
		undoManager.addToScope( ymap );

		ydoc.transact( () => {
			ymap.set( 'key1', 'value1' );
		}, 'gutenberg' );

		undoManager.undo();
		expect( ymap.get( 'key1' ) ).toBeUndefined();

		expect( undoManager.redo() ).toEqual( [] );
		expect( ymap.get( 'key1' ) ).toBe( 'value1' );
	} );

	it( 'hasUndo returns false when no undo available', () => {
		undoManager = UndoManager.create();
		undoManager.addToScope( ymap );

		expect( undoManager.hasUndo() ).toBe( false );
	} );

	it( 'hasUndo returns true after making changes', () => {
		undoManager = UndoManager.create();
		undoManager.addToScope( ymap );

		ydoc.transact( () => {
			ymap.set( 'key1', 'value1' );
		}, 'gutenberg' );

		expect( undoManager.hasUndo() ).toBe( true );
	} );

	it( 'hasRedo returns false when no redo available', () => {
		undoManager = UndoManager.create();
		undoManager.addToScope( ymap );

		expect( undoManager.hasRedo() ).toBe( false );
	} );

	it( 'hasRedo returns true after undoing changes', () => {
		undoManager = UndoManager.create();
		undoManager.addToScope( ymap );

		ydoc.transact( () => {
			ymap.set( 'key1', 'value1' );
		}, 'gutenberg' );

		undoManager.undo();

		expect( undoManager.hasRedo() ).toBe( true );
	} );

	describe( 'integration workflow', () => {
		it( 'follows typical undo/redo workflow', () => {
			undoManager = UndoManager.create();
			undoManager.addToScope( ymap );

			// Initially no undo/redo available
			expect( undoManager.hasUndo() ).toBe( false );
			expect( undoManager.hasRedo() ).toBe( false );

			// Make a change
			ydoc.transact( () => {
				ymap.set( 'key1', 'value1' );
			}, 'gutenberg' );

			// Now undo is available
			expect( undoManager.hasUndo() ).toBe( true );
			expect( undoManager.hasRedo() ).toBe( false );

			// Undo the change
			undoManager.undo();
			expect( undoManager.hasUndo() ).toBe( false );
			expect( undoManager.hasRedo() ).toBe( true );

			// Redo the change
			undoManager.redo();
			expect( undoManager.hasUndo() ).toBe( true );
			expect( undoManager.hasRedo() ).toBe( false );
		} );

		it( 'handles multiple scopes', () => {
			undoManager = UndoManager.create();
			const ydoc2 = new Y.Doc();
			const ymap2 = ydoc2.getMap( 'test2' );

			undoManager.addToScope( ymap );
			undoManager.addToScope( ymap2 );

			// Make changes in both docs
			ydoc.transact( () => {
				ymap.set( 'doc1', 'value1' );
			}, 'gutenberg' );

			ydoc2.transact( () => {
				ymap2.set( 'doc2', 'value2' );
			}, 'gutenberg' );

			expect( undoManager.hasUndo() ).toBe( true );

			// Undo should work across both docs
			undoManager.undo();
			expect( ymap2.get( 'doc2' ) ).toBeUndefined();

			undoManager.undo();
			expect( ymap.get( 'doc1' ) ).toBeUndefined();

			ydoc2.destroy();
		} );
	} );
} );
