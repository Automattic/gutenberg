/**
 * External dependencies
 */
import { describe, expect, it } from '@jest/globals';

/**
 * Internal dependencies
 */
import Delta from '../quill-delta/Delta';

describe( 'Delta.diffWithCursor', () => {
	describe( 'insertions', () => {
		it( 'should handle insertion at beginning', () => {
			// '|aaa' -> 'a|aaa'
			const oldDelta = new Delta().insert( 'aaa' );
			const newDelta = new Delta().insert( 'aaaa' );
			const cursorAfterChange = 1; // After adding an 'a' at the front

			const diff = oldDelta.diffWithCursor( newDelta, cursorAfterChange );

			// Cursor at beginning - should still work correctly
			expect( diff.ops ).toEqual( [ { insert: 'a' } ] );
		} );

		it( 'should place insertion at cursor position in the middle of repeated characters', () => {
			// 'a|aa' -> 'aa|aa'
			const oldDelta = new Delta().insert( 'aaa' );
			const newDelta = new Delta().insert( 'aaaa' );
			const cursor = 2; // After adding an 'a' at the second character

			const diff = oldDelta.diffWithCursor( newDelta, cursor );

			// Should retain 1 character, insert 'a', then retain 3 more
			expect( diff.ops ).toEqual( [ { retain: 1 }, { insert: 'a' } ] );
		} );

		it( 'should place insertion at cursor position at the end of repeated characters', () => {
			// 'aaa|' -> 'aaaa|'
			const oldDelta = new Delta().insert( 'aaa' );
			const newDelta = new Delta().insert( 'aaaa' );
			const cursor = 4; // After adding an 'a' at the end

			const diff = oldDelta.diffWithCursor( newDelta, cursor );

			// Should retain 1 character, insert 'a', then retain 3 more
			expect( diff.ops ).toEqual( [ { retain: 3 }, { insert: 'a' } ] );
		} );

		it( 'should place insertion at cursor position in regular string', () => {
			// 'hello |world' -> 'hello l|world'
			const oldDelta = new Delta().insert( 'hello world' );
			const newDelta = new Delta().insert( 'hello lworld' );
			const cursor = 7; // After adding an 'l' before 'world'

			const diff = oldDelta.diffWithCursor( newDelta, cursor );

			expect( diff.ops ).toEqual( [ { retain: 6 }, { insert: 'l' } ] );
		} );

		it( 'should handle insertion in middle of non-repeated characters', () => {
			// 'a|bc' -> 'ab|bc'
			const oldDelta = new Delta().insert( 'abc' );
			const newDelta = new Delta().insert( 'abbc' );
			const cursor = 2; // After adding a 'b' after 'a'

			const diff = oldDelta.diffWithCursor( newDelta, cursor );

			expect( diff.ops ).toEqual( [ { retain: 1 }, { insert: 'b' } ] );
		} );

		it( 'should handle multi-character insertion', () => {
			// 'a|aaaaa' -> 'aaaaa|aaaaa'
			const oldDelta = new Delta().insert( 'aaaaaa' );
			const newDelta = new Delta().insert( 'aaaaaaaaaa' );
			const cursor = 5; // After adding 'aaaa' starting at the second character

			const diff = oldDelta.diffWithCursor( newDelta, cursor );

			expect( diff.ops ).toEqual( [ { retain: 1 }, { insert: 'aaaa' } ] );
		} );
	} );

	describe( 'deletions', () => {
		it( 'should place deletion at cursor position with repeated characters', () => {
			// aa|aa -> a|aa
			const oldDelta = new Delta().insert( 'aaaa' );
			const newDelta = new Delta().insert( 'aaa' );
			const cursor = 1; // After deleting the second 'a'

			const diff = oldDelta.diffWithCursor( newDelta, cursor );

			// Should retain 1 character, delete 1, then retain 2 more
			expect( diff.ops ).toEqual( [ { retain: 1 }, { delete: 1 } ] );
		} );

		it( 'should place deletion at cursor position in a regular string', () => {
			// hello l|world -> hello |world
			const oldDelta = new Delta().insert( 'hello lworld' );
			const newDelta = new Delta().insert( 'hello world' );
			const cursor = 6; // After deleting the 'l' before 'world'

			const diff = oldDelta.diffWithCursor( newDelta, cursor );

			expect( diff.ops ).toEqual( [ { retain: 6 }, { delete: 1 } ] );
		} );

		it( 'should handle deletion at beginning', () => {
			// 'a|aaa' -> '|aaa'
			const oldDelta = new Delta().insert( 'aaaa' );
			const newDelta = new Delta().insert( 'aaa' );
			const cursor = 0;

			const diff = oldDelta.diffWithCursor( newDelta, cursor );

			// Cursor at beginning
			expect( diff.ops ).toEqual( [ { delete: 1 } ] );
		} );

		it( 'should handle deletion in middle of non-repeated characters', () => {
			// 'ab|bc' -> 'a|bc'
			const oldDelta = new Delta().insert( 'abbc' );
			const newDelta = new Delta().insert( 'abc' );
			const cursor = 1; // After "ab", where the 'b' was deleted

			const diff = oldDelta.diffWithCursor( newDelta, cursor );

			expect( diff.ops ).toEqual( [ { retain: 1 }, { delete: 1 } ] );
		} );

		it( 'should handle multi-character deletion', () => {
			// 'aaaaa|aaaaa' -> 'a|aaaaa'
			const oldDelta = new Delta().insert( 'aaaaaaaaaa' );
			const newDelta = new Delta().insert( 'aaaaaa' );
			const cursor = 1; // Delete "aaaa" until cursor position after the first 'a'

			const diff = oldDelta.diffWithCursor( newDelta, cursor );

			expect( diff.ops ).toEqual( [ { retain: 1 }, { delete: 4 } ] );
		} );
	} );

	describe( 'edge cases', () => {
		it( 'should handle no changes', () => {
			const oldDelta = new Delta().insert( 'hello' );
			const newDelta = new Delta().insert( 'hello' );
			const cursor = 2;

			const diff = oldDelta.diffWithCursor( newDelta, cursor );

			expect( diff.ops ).toEqual( [] );
		} );

		it( 'should fallback to default diff behavior when cursor hint does not help', () => {
			const oldDelta = new Delta().insert( 'abc' );
			const newDelta = new Delta().insert( 'abcd' );
			const cursor = 1; // Cursor at 1, but insertion is at end

			const diff = oldDelta.diffWithCursor( newDelta, cursor );

			// Since 'd' is not at cursor position, should fall back to default
			expect( diff.ops ).toEqual( [ { retain: 3 }, { insert: 'd' } ] );
		} );
	} );
} );
