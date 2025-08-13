/**
 * External dependencies
 */
import type { Meta } from '@storybook/react';

/**
 * WordPress dependencies
 */
import {
	useState,
	useMemo,
	createInterpolateElement,
} from '@wordpress/element';
import {
	Card,
	CardHeader,
	CardBody,
	__experimentalGrid as Grid,
	__experimentalHeading as Heading,
	__experimentalText as Text,
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
	Button,
} from '@wordpress/components';
import { __, _n } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import DataViews from '../index';
import {
	DEFAULT_VIEW,
	actions,
	data,
	fields,
	type SpaceObject,
} from './fixtures';
import { LAYOUT_GRID, LAYOUT_LIST, LAYOUT_TABLE } from '../../../constants';
import { filterSortAndPaginate } from '../../../filter-and-sort-data-view';
import type { Field, View } from '../../../types';

import './style.css';

const meta = {
	title: 'DataViews/DataViews',
	component: DataViews,
} as Meta< typeof DataViews >;

export default meta;

const defaultLayouts = {
	[ LAYOUT_TABLE ]: {},
	[ LAYOUT_GRID ]: {},
	[ LAYOUT_LIST ]: {},
};

export const Default = ( { perPageSizes = [ 10, 25, 50, 100 ] } ) => {
	const [ view, setView ] = useState< View >( {
		...DEFAULT_VIEW,
		fields: [ 'categories' ],
		titleField: 'title',
		descriptionField: 'description',
		mediaField: 'image',
	} );
	const { data: shownData, paginationInfo } = useMemo( () => {
		return filterSortAndPaginate( data, view, fields );
	}, [ view ] );
	return (
		<DataViews
			getItemId={ ( item ) => item.id.toString() }
			paginationInfo={ paginationInfo }
			data={ shownData }
			view={ view }
			fields={ fields }
			onChangeView={ setView }
			actions={ actions }
			renderItemLink={ ( { item, ...props }: { item: SpaceObject } ) => (
				<button
					style={ { background: 'none', border: 'none', padding: 0 } }
					onClick={ ( e ) => {
						e.stopPropagation();
						// eslint-disable-next-line no-alert
						alert( 'Clicked: ' + item.title );
					} }
					{ ...props }
				/>
			) }
			isItemClickable={ () => true }
			defaultLayouts={ defaultLayouts }
			perPageSizes={ perPageSizes }
		/>
	);
};

Default.args = {
	perPageSizes: [ 10, 25, 50, 100 ],
};

Default.argTypes = {
	perPageSizes: {
		control: 'object',
		description: 'Array of available page sizes',
	},
};

export const Empty = () => {
	const [ view, setView ] = useState< View >( {
		...DEFAULT_VIEW,
		fields: [ 'title', 'description', 'categories' ],
	} );

	return (
		<DataViews
			getItemId={ ( item ) => item.id.toString() }
			paginationInfo={ { totalItems: 0, totalPages: 0 } }
			data={ [] }
			view={ view }
			fields={ fields }
			onChangeView={ setView }
			actions={ actions }
			defaultLayouts={ defaultLayouts }
		/>
	);
};

export const CustomEmpty = () => {
	const [ view, setView ] = useState< View >( {
		...DEFAULT_VIEW,
		fields: [ 'title', 'description', 'categories' ],
	} );

	return (
		<DataViews
			getItemId={ ( item ) => item.id.toString() }
			paginationInfo={ { totalItems: 0, totalPages: 0 } }
			data={ [] }
			view={ view }
			fields={ fields }
			onChangeView={ setView }
			actions={ actions }
			defaultLayouts={ defaultLayouts }
			empty={ view.search ? 'No sites found' : 'No sites' }
		/>
	);
};

export const NonInteractive = () => {
	const [ view, setView ] = useState< View >( {
		...DEFAULT_VIEW,
		fields: [ 'title', 'description', 'categories' ],
		layout: {
			enableMoving: false,
		},
	} );
	const { data: shownData, paginationInfo } = useMemo( () => {
		return filterSortAndPaginate( data, view, fields );
	}, [ view ] );

	const _fields: Field< SpaceObject >[] = fields.map( ( field ) => ( {
		...field,
		enableSorting: false,
		enableHiding: false,
		filterBy: false,
	} ) );

	return (
		<DataViews
			getItemId={ ( item ) => item.id.toString() }
			paginationInfo={ paginationInfo }
			data={ shownData }
			view={ view }
			fields={ _fields }
			perPageSizes={ [] }
			search={ false }
			onChangeView={ setView }
			defaultLayouts={ {
				table: {},
			} }
		/>
	);
};

/**
 * Custom composition example
 */
function PlanetOverview( { planets }: { planets: SpaceObject[] } ) {
	const moons = planets.reduce( ( sum, item ) => sum + item.satellites, 0 );

	return (
		<>
			<Heading className="free-composition-heading" level={ 2 }>
				{ __( 'Solar System numbers' ) }
			</Heading>
			<Grid
				templateColumns="repeat(auto-fit, minmax(330px, 1fr))"
				align="flex-start"
				className="free-composition-header"
			>
				<Card variant="secondary">
					<CardBody>
						<VStack>
							<Text size={ 18 } as="p">
								{ createInterpolateElement(
									_n(
										'<PlanetsNumber /> planet',
										'<PlanetsNumber /> planets',
										planets.length
									),
									{
										PlanetsNumber: (
											<strong>{ planets.length } </strong>
										),
									}
								) }
							</Text>

							<Text size={ 18 } as="p">
								{ createInterpolateElement(
									_n(
										'<SatellitesNumber /> moon',
										'<SatellitesNumber /> moons',
										moons
									),
									{
										SatellitesNumber: (
											<strong>{ moons } </strong>
										),
									}
								) }
							</Text>
						</VStack>
					</CardBody>
				</Card>

				<VStack>
					<HStack justify="start">
						<DataViews.FiltersToggle />
						<DataViews.Search label={ __( 'moons by planet' ) } />
					</HStack>
					<DataViews.Filters />
				</VStack>

				<VStack>
					<HStack justify="end">
						<DataViews.Pagination />
						<DataViews.ViewConfig />
						<DataViews.LayoutSwitcher />
					</HStack>

					<DataViews.BulkActionToolbar />
				</VStack>
			</Grid>

			<DataViews.Layout className="free-composition-dataviews-layout" />
		</>
	);
}

/**
 * This is a basic example of using the DataViews component in
 * a free composition mode.
 *
 * Unlike the default usage where DataViews renders its own UI,
 * here we use it purely to provide context and handle data-related logic.
 *
 * The UI is fully custom and composed externally via the
 * `PlanetOverview` component.
 *
 * In future iterations, this story will showcase more advanced compositions
 * using built-in subcomponents like <Search />, filters,
 * or pagination controls.
 */
export const FreeComposition = () => {
	const [ view, setView ] = useState< View >( {
		...DEFAULT_VIEW,
		fields: [ 'categories' ],
		titleField: 'title',
		descriptionField: 'description',
		mediaField: 'image',
	} );

	const { data: processedData, paginationInfo } = useMemo( () => {
		return filterSortAndPaginate( data, view, fields );
	}, [ view ] );

	const planets = processedData.filter( ( item ) =>
		item.categories.includes( 'Planet' )
	);

	return (
		<div className="free-composition">
			<DataViews
				getItemId={ ( item ) => item.id.toString() }
				paginationInfo={ paginationInfo }
				data={ processedData }
				view={ view }
				fields={ fields }
				actions={ actions }
				onChangeView={ setView }
				defaultLayouts={ {
					table: {},
					grid: {},
				} }
				empty={
					<VStack
						justify="space-around"
						alignment="center"
						className="free-composition-dataviews-empty"
					>
						<Text size={ 18 } as="p">
							No planets
						</Text>
						<Text variant="muted">{ `Try a different search because “${ view.search }” returned no results.` }</Text>
						<Button variant="secondary">Create new planet</Button>
					</VStack>
				}
			>
				<PlanetOverview planets={ planets } />
			</DataViews>
		</div>
	);
};

export const WithCard = () => {
	const [ view, setView ] = useState< View >( {
		...DEFAULT_VIEW,
		fields: [ 'categories' ],
		titleField: 'title',
		descriptionField: 'description',
		mediaField: 'image',
	} );
	const { data: shownData, paginationInfo } = useMemo( () => {
		return filterSortAndPaginate( data, view, fields );
	}, [ view ] );
	return (
		<Card>
			<CardHeader>Header</CardHeader>
			<CardBody>
				<DataViews
					getItemId={ ( item ) => item.id.toString() }
					paginationInfo={ paginationInfo }
					data={ shownData }
					view={ view }
					fields={ fields }
					onChangeView={ setView }
					actions={ actions.filter(
						( action ) => ! action.supportsBulk
					) }
					defaultLayouts={ defaultLayouts }
				/>
			</CardBody>
		</Card>
	);
};

export const GroupByLayout = () => {
	const [ view, setView ] = useState< View >( {
		type: LAYOUT_GRID,
		search: '',
		page: 1,
		perPage: 20,
		filters: [],
		fields: [ 'satellites' ],
		titleField: 'title',
		descriptionField: 'description',
		mediaField: 'image',
		groupByField: 'type',
		layout: {
			badgeFields: [ 'satellites' ],
		},
	} );
	const { data: shownData, paginationInfo } = useMemo( () => {
		return filterSortAndPaginate( data, view, fields );
	}, [ view ] );
	return (
		<DataViews
			getItemId={ ( item ) => item.id.toString() }
			paginationInfo={ paginationInfo }
			data={ shownData }
			view={ view }
			fields={ fields }
			onChangeView={ setView }
			actions={ actions }
			defaultLayouts={ {
				[ LAYOUT_GRID ]: {},
				[ LAYOUT_LIST ]: {},
				[ LAYOUT_TABLE ]: {},
			} }
		/>
	);
};
