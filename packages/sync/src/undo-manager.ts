/**
 * External dependencies
 */
import { YMultiDocUndoManager } from 'y-utility/y-multidoc-undomanager';

/**
 * WordPress dependencies
 */
import type {
	HistoryRecord,
	UndoManager as WPUndoManager,
} from '@wordpress/undo-manager';

/**
 * Internal dependencies
 */
import type { CRDTDoc, ObjectData } from './types';

/**
 * Wrapper class that provides the WordPress UndoManager interface while using Y.UndoManager internally.
 * This allows seamless integration between Yjs collaborative editing and WordPress undo/redo functionality.
 */
export class UndoManager implements WPUndoManager< ObjectData > {
	private undoManager: YMultiDocUndoManager;

	public constructor() {
		this.undoManager = new YMultiDocUndoManager( [], {
			trackedOrigins: new Set( [ 'gutenberg' ] ),
			captureTimeout: 0,
			ignoreRemoteMapChanges: true,
		} );
	}

	public addDocToTrack( ydoc: CRDTDoc ): void {
		this.undoManager.addToScope( ydoc );
		this.undoManager.addTrackedOrigin( ydoc.clientID );
	}

	/**
	 * Record changes into the history.
	 * Since Yjs automatically tracks changes, this method translates the WordPress
	 * HistoryRecord format into Yjs operations.
	 *
	 * @param _record   A record of changes to record.
	 * @param _isStaged Whether to immediately create an undo point or not.
	 */
	public addRecord(
		_record?: HistoryRecord< ObjectData >,
		_isStaged = false // eslint-disable-line @typescript-eslint/no-unused-vars
	): void {
		// This is a no-op for Yjs since it automatically tracks changes.
		// If needed, we could implement custom logic to handle specific records.
	}

	/**
	 * Undo the last recorded changes.
	 *
	 * @return The undone record or undefined if nothing to undo.
	 */
	public undo(): HistoryRecord< ObjectData > | undefined {
		if ( ! this.hasUndo() ) {
			return;
		}

		// Perform the undo operation
		this.undoManager.undo();

		// @TODO See if the undo operation can return a record from Yjs.
		return [];
	}

	/**
	 * Redo the last undone changes.
	 *
	 * @return The redone record or undefined if nothing to redo.
	 */
	public redo(): HistoryRecord< ObjectData > | undefined {
		if ( ! this.hasRedo() ) {
			return;
		}

		// Perform the redo operation
		this.undoManager.redo();

		// @TODO See if the redo operation can return a record from Yjs.
		return [];
	}

	/**
	 * Check if there are changes that can be undone.
	 *
	 * @return Whether there are changes to undo.
	 */
	public hasUndo(): boolean {
		return this.undoManager.canUndo();
	}

	/**
	 * Check if there are changes that can be redone.
	 *
	 * @return Whether there are changes to redo.
	 */
	public hasRedo(): boolean {
		return this.undoManager.canRedo();
	}
}
