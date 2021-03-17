/**
 * WordPress dependencies
 */
import { Placeholder, Spinner, SelectControl } from '@wordpress/components';
import { BlockIcon } from '@wordpress/block-editor';
import { brush as brushIcon } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';

export default function LegacyWidgetEditPlaceholder( {
	widgetTypeId,
	onSelectWidgetType,
} ) {
	// TODO: Filter out hidden widgets.

	const widgetTypes = useSelect(
		( select ) => select( coreStore ).getWidgetTypes( { per_page: -1 } ),
		[]
	);

	return (
		<Placeholder
			icon={ <BlockIcon icon={ brushIcon } /> }
			label={ __( 'Legacy Widget' ) }
		>
			{ ! widgetTypes && <Spinner /> }

			{ widgetTypes?.length === 0 &&
				__( 'There are no widgets available.' ) }

			{ widgetTypes?.length && (
				<SelectControl
					label={ __( 'Select a legacy widget to display:' ) }
					value={ widgetTypeId }
					options={ [
						{ value: null, label: __( 'Select widget' ) },
						...widgetTypes.map( ( widgetType ) => ( {
							value: widgetType.id,
							label: widgetType.name,
						} ) ),
					] }
					onChange={ ( selectedId ) => {
						if ( selectedId ) {
							const selectedWidgetType = widgetTypes.find(
								( widgetType ) => widgetType.id === selectedId
							);
							onSelectWidgetType( {
								widgetTypeId: selectedWidgetType.id,
								// TODO: Don't use widget_class.
								isMulti: !! selectedWidgetType.widget_class,
							} );
						} else {
							onSelectWidgetType( { widgetTypeId: null } );
						}
					} }
				/>
			) }
		</Placeholder>
	);
}
