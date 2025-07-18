/**
 * WordPress dependencies
 */
import { useMergeRefs } from '@wordpress/compose';
import { forwardRef, useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { ControlWithError } from '../control-with-error';
import type { ValidatedControlProps } from './types';
import RangeControl from '../../range-control';
import type { RangeControlProps } from '../../range-control/types';

type Value = RangeControlProps[ 'value' ];

const UnforwardedValidatedRangeControl = (
	{
		required,
		customValidator,
		onChange,
		markWhenOptional,
		...restProps
	}: Omit<
		React.ComponentProps< typeof RangeControl >,
		'__next40pxDefaultSize' | '__nextHasNoMarginBottom'
	> &
		ValidatedControlProps< Value >,
	forwardedRef: React.ForwardedRef< HTMLInputElement >
) => {
	const validityTargetRef = useRef< HTMLInputElement >( null );
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
			<RangeControl
				__next40pxDefaultSize
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

export const ValidatedRangeControl = forwardRef(
	UnforwardedValidatedRangeControl
);
