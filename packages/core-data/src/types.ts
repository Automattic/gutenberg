export interface AnyFunction {
	( ...args: any[] ): any;
}

// Avoid a circular dependency with @wordpress/editor
export type WPBlockSelection = {
	clientId: string;
	attributeKey: string;
	offset: number;
};
