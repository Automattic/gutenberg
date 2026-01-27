/**
 * External dependencies
 */
import { useEffect, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { getSyncManager } from '../sync';
import type {
	PostEditorAwarenessState as ActiveUser,
	PostEditorAwarenessState,
} from '../awareness/types';
import type { SelectionCursor } from '../types';
import type { PostEditorAwareness } from '../awareness/post-editor-awareness';
import { type EnhancedState } from '@wordpress/sync';

interface AwarenessState {
	activeUsers: ActiveUser[];
	getAbsolutePositionIndex: ( selection: SelectionCursor ) => number | null;
	isCurrentUserDisconnected: boolean;
}

const defaultState: AwarenessState = {
	activeUsers: [],
	getAbsolutePositionIndex: () => null,
	isCurrentUserDisconnected: false,
};

function getPostEditorAwarenessState(
	postId: number | null,
	postType: string | null,
	awareness?: PostEditorAwareness,
	newState?: EnhancedState< PostEditorAwarenessState >[]
): PostEditorAwarenessState {
	if ( ! postId || ! postType || ! awareness ) {
		return defaultState;
	}

	const stateSnapshot =
		typeof newState !== 'undefined'
			? newState
			: awareness.getLastSnapshot();

	if ( ! stateSnapshot ) {
		return defaultState;
	}

	return {
		activeUsers: stateSnapshot,
		getAbsolutePositionIndex: ( selection: SelectionCursor ) =>
			awareness.getAbsolutePositionIndex( selection ),
		isCurrentUserDisconnected:
			stateSnapshot.find( ( user ) => user.isMe )?.isConnected === false,
	};
}

function usePostEditorAwarenessState(
	postId: number | null,
	postType: string | null
): PostEditorAwarenessState {
	const [ state, setState ] = useState< PostEditorAwarenessState >( () => {
		const awareness =
			! postId || ! postType
				? undefined
				: ( getSyncManager()?.getAwareness(
						`postType/${ postType }`,
						postId.toString()
				  ) as unknown as PostEditorAwareness | undefined );

		return getPostEditorAwarenessState( postId, postType, awareness );
	} );

	useEffect( () => {
		if ( null === postId || null === postType ) {
			return;
		}

		const awareness = getSyncManager()?.getAwareness(
			`postType/${ postType }`,
			postId.toString()
		) as unknown as PostEditorAwareness | undefined;

		const unsubscribe = awareness?.onStateChange( ( newState ) => {
			setState(
				getPostEditorAwarenessState(
					postId,
					postType,
					awareness,
					newState
				)
			);
		} );

		return unsubscribe;
	}, [ postId, postType ] );

	return state;
}

export function useActiveUsers(
	postId: number | null,
	postType: string | null
): ActiveUser[] {
	return usePostEditorAwarenessState( postId, postType ).activeUsers;
}

export function useGetAbsolutePositionIndex(
	postId: number | null,
	postType: string | null
): ( selection: SelectionCursor ) => number | null {
	return usePostEditorAwarenessState( postId, postType )
		.getAbsolutePositionIndex;
}

export function useIsDisconnected(
	postId: number | null,
	postType: string | null
): boolean {
	return usePostEditorAwarenessState( postId, postType )
		.isCurrentUserDisconnected;
}
