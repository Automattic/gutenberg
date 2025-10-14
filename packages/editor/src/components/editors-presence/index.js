/**
 * WordPress dependencies
 */
import { createSlotFill } from '@wordpress/components';

const { Fill, Slot } = createSlotFill( 'EditorsPresence' );

export const EditorsPresenceFill = Fill;

export function Avatar( props ) {
	return <div>{ props.name }</div>;
}

export function EditorsPresence( { children } ) {
	return <Fill>{ children }</Fill>;
}

EditorsPresence.Slot = Slot;
