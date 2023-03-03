type PivotTableUIProps = {
    aggregatorName?: string;
    aggregators?: Record<string, Function>;
    colOrder?: string;
    cols?: Array<string>;
    derivedAttributes?: Record<string, Function>;
    data: Array<Record<string, any>>;
    enableColumnSorting?: boolean;
    hiddenAttributes?: Array<string>;
    hiddenFromAggregators?: Array<string>;
    hiddenFromDragDrop?: Array<string>;
    menuLimit?: number;
    rendererName?: string;
    renderers?: Record<string, Function>;
    rowOrder?: string;
    rows?: Array<string>;
    sorters?: Record<string, Function>;
    tableColorScaleGenerator?: Record<string, Function>;
    tableOptions?: Record<string, any>;
    unusedOrientationCutoff?: number;
    valueFilter?: Record<string, Function>;
    vals?: Array<string>;
    onChange: (state: PivotTableUIProps) => void;
    valueFormatter?: (cellValue?: number) => string;
};

declare const PivotTableUI: React.FC<PivotTableUIProps>;
export default PivotTableUI;
