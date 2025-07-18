/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';

/**
 * External dependencies
 */
import type { Meta, StoryObj } from '@storybook/react';

/**
 * Internal dependencies
 */
import { ValidatedInputControl } from '..';
import { formDecorator } from './story-utils';
import type { ControlWithError } from '../../control-with-error';

const meta: Meta< typeof ControlWithError > = {
	title: 'Components (Experimental)/Validated Form Controls/Overview',
	tags: [ 'status-private' ],
	decorators: formDecorator,
};
export default meta;

type Story = StoryObj< typeof ControlWithError >;

/**
 * When there are multiple controls with errors, attempting to submit will
 * move focus to the first control with an error.
 */
export const WithMultipleControls: Story = {
	render: function Template() {
		const [ text, setText ] = useState( '' );
		const [ text2, setText2 ] = useState( '' );

		return (
			<>
				<ValidatedInputControl
					label="Text"
					required
					value={ text }
					help="The word 'error' will trigger an error."
					customValidator={ ( value ) => {
						if ( value?.toLowerCase() === 'error' ) {
							return 'The word "error" is not allowed.';
						}
						return undefined;
					} }
					onChange={ ( value ) => setText( value ?? '' ) }
				/>
				<ValidatedInputControl
					label="Text"
					required
					value={ text2 }
					help="The word 'error' will trigger an error."
					customValidator={ ( value ) => {
						if ( value?.toLowerCase() === 'error' ) {
							return 'The word "error" is not allowed.';
						}
						return undefined;
					} }
					onChange={ ( value ) => setText2( value ?? '' ) }
				/>
			</>
		);
	},
};

/**
 * Help text can be configured to be hidden when a custom error is reported. Whether to opt for this approach
 * will depend on context.
 */
export const WithHelpTextReplacement: Story = {
	render: function Template() {
		const [ text, setText ] = useState( '' );
		const [ hasCustomError, setHasCustomError ] = useState( false );

		return (
			<ValidatedInputControl
				label="Text"
				required
				value={ text }
				help={
					hasCustomError
						? undefined
						: 'The word "error" is not allowed.'
				}
				customValidator={ ( value ) => {
					if ( value?.toLowerCase() === 'error' ) {
						setHasCustomError( true );
						return 'The word "error" is not allowed.';
					}
					setHasCustomError( false );
					return undefined;
				} }
				onChange={ ( value ) => setText( value ?? '' ) }
			/>
		);
	},
};
