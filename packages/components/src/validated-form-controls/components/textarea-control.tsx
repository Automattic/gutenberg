/**
 * WordPress dependencies
 */
import { forwardRef, useRef } from '@wordpress/element';
import { useMergeRefs } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import { ControlWithError } from '../control-with-error';
import type { ValidatedControlProps } from './types';
import TextareaControl from '../../textarea-control';
import type { TextareaControlProps } from '../../textarea-control/types';

type Value = TextareaControlProps[ 'value' ];

const UnforwardedValidatedTextareaControl = (
	{
		required,
		customValidator,
		onChange,
		markWhenOptional,
		...restProps
	}: Omit<
		React.ComponentProps< typeof TextareaControl >,
		'__nextHasNoMarginBottom'
	> &
		ValidatedControlProps< Value >,
	forwardedRef: React.ForwardedRef< HTMLTextAreaElement >
) => {
	const validityTargetRef = useRef< HTMLTextAreaElement >( null );
	const mergedRefs = useMergeRefs( [ forwardedRef, validityTargetRef ] );
	const valueRef = useRef< Value >( restProps.value );

	return (
		<ControlWithError
			required={ required }
			markWhenOptional={ markWhenOptional }
			customValidator={ () => {
				return customValidator?.( valueRef.current );
			} }
			getValidityTarget={ () => validityTargetRef.current }
		>
			<TextareaControl
				__nextHasNoMarginBottom
				ref={ mergedRefs }
				onChange={ ( value ) => {
					valueRef.current = value;
					onChange?.( value );
				} }
				{ ...restProps }
			/>
		</ControlWithError>
	);
};

export const ValidatedTextareaControl = forwardRef(
	UnforwardedValidatedTextareaControl
);
