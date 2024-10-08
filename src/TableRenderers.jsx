import React from 'react';
import PropTypes from 'prop-types';
import {
    PivotData,
    ASCENDING_SORT_LABEL,
    DESCENDING_SORT_LABEL,
    ROW_COL_KEY_JOINER
} from './Utilities';
import update from 'immutability-helper';

// helper function for setting row/col-span in pivotTableRenderer
const spanSize = function(arr, i, j) {
    let x;
    if (i !== 0) {
        let asc, end;
        let noDraw = true;
        for (
            x = 0, end = j, asc = end >= 0;
            asc ? x <= end : x >= end;
            asc ? x++ : x--
        ) {
            if (arr[i - 1][x] !== arr[i][x]) {
                noDraw = false;
            }
        }
        if (noDraw) {
            return -1;
        }
    }
    let len = 0;
    while (i + len < arr.length) {
        let asc1, end1;
        let stop = false;
        for (
            x = 0, end1 = j, asc1 = end1 >= 0;
            asc1 ? x <= end1 : x >= end1;
            asc1 ? x++ : x--
        ) {
            if (arr[i][x] !== arr[i + len][x]) {
                stop = true;
            }
        }
        if (stop) {
            break;
        }
        len++;
    }
    return len;
};

function redColorScaleGenerator(values) {
    const min = Math.min.apply(Math, values);
    const max = Math.max.apply(Math, values);
    return x => {
        // eslint-disable-next-line no-magic-numbers
        const nonRed = 255 - Math.round((255 * (x - min)) / (max - min));
        return { backgroundColor: `rgb(255,${nonRed},${nonRed})` };
    };
}

// Some aggregators return values in the same units as the original
// data. For these aggregators, we should use the provided valueFormatter
// if it exists. Otherwise, we should use the standard agrregator's formatter.
// E.g. A Sum of values in USD makes sense to be formatted with a "$"".
// A Count of those values does not make sense to be formatted at all.
const originalUnitAggregatorNames = [
    'Sum',
    'Average',
    'Median',
    'Minimum',
    'Maximum',
    'First',
    'Last',
    'Sum over Sum'
];

function makeRenderer(opts = {}) {
    class TableRenderer extends React.PureComponent {
        render() {
            const pivotData = new PivotData(this.props);
            const colAttrs = pivotData.props.cols;
            const rowAttrs = pivotData.props.rows;
            const rowKeys = this.props.sortingColumn
                ? pivotData.getUserSortedRowKeys(
                      this.props.sortingColumn.name,
                      this.props.sortingColumn.order
                  )
                : pivotData.getRowKeys();
            const colKeys = pivotData.getColKeys();
            const valueFormatter =
                originalUnitAggregatorNames.includes(
                    this.props.aggregatorName
                ) && this.props.valueFormatter;
            const grandTotalAggregator = pivotData.getAggregator([], []);
            const grandTotalFormatter =
                valueFormatter || grandTotalAggregator.format;

            let valueCellColors = () => {};
            let rowTotalColors = () => {};
            let colTotalColors = () => {};
            if (opts.heatmapMode) {
                const colorScaleGenerator = this.props.tableColorScaleGenerator;
                const rowTotalValues = colKeys.map(x =>
                    pivotData.getAggregator([], x).value()
                );
                rowTotalColors = colorScaleGenerator(rowTotalValues);
                const colTotalValues = rowKeys.map(x =>
                    pivotData.getAggregator(x, []).value()
                );
                colTotalColors = colorScaleGenerator(colTotalValues);

                if (opts.heatmapMode === 'full') {
                    const allValues = [];
                    rowKeys.map(r =>
                        colKeys.map(c =>
                            allValues.push(
                                pivotData.getAggregator(r, c).value()
                            )
                        )
                    );
                    const colorScale = colorScaleGenerator(allValues);
                    valueCellColors = (r, c, v) => colorScale(v);
                } else if (opts.heatmapMode === 'row') {
                    const rowColorScales = {};
                    rowKeys.map(r => {
                        const rowValues = colKeys.map(x =>
                            pivotData.getAggregator(r, x).value()
                        );
                        rowColorScales[r] = colorScaleGenerator(rowValues);
                    });
                    valueCellColors = (r, c, v) => rowColorScales[r](v);
                } else if (opts.heatmapMode === 'col') {
                    const colColorScales = {};
                    colKeys.map(c => {
                        const colValues = rowKeys.map(x =>
                            pivotData.getAggregator(x, c).value()
                        );
                        colColorScales[c] = colorScaleGenerator(colValues);
                    });
                    valueCellColors = (r, c, v) => colColorScales[c](v);
                }
            }

            const getSortButtonClassNames = columnKeySet => {
                const uniqueColumnKey = columnKeySet.join(ROW_COL_KEY_JOINER);
                const { sortingColumn } = this.props;
                let classes = 'pvtColSortButton';
                if (sortingColumn && sortingColumn.name === uniqueColumnKey) {
                    if (sortingColumn.order === ASCENDING_SORT_LABEL) {
                        classes += ' pvtColSortButton-asc-active';
                    }

                    if (sortingColumn.order === DESCENDING_SORT_LABEL) {
                        classes += ' pvtColSortButton-desc-active';
                    }
                }

                return classes;
            };

            const updateSortingColumn = column => {
                this.props.onChange(
                    update(this.props, {
                        sortingColumn: { $set: column }
                    })
                );
            };

            const handleSortButtonClick = (columnKeySet = []) => {
                if (pivotData.props.rows.length === 0) {
                    return;
                }

                // Find the current sorting column state
                const { sortingColumn } = this.props;
                const uniqueColumnKey = columnKeySet.join(ROW_COL_KEY_JOINER);
                // If this is the first time this sort button has been clicked, set it's sorting to ascending
                if (!sortingColumn || sortingColumn.name !== uniqueColumnKey) {
                    updateSortingColumn({
                        name: uniqueColumnKey,
                        order: ASCENDING_SORT_LABEL
                    });
                } else {
                    if (sortingColumn.order === ASCENDING_SORT_LABEL) {
                        // If it was already in the ascending state, set it to descending
                        updateSortingColumn({
                            name: uniqueColumnKey,
                            order: DESCENDING_SORT_LABEL
                        });
                    } else {
                        // If it was already in the descending state, clear the sorting state
                        updateSortingColumn(null);
                    }
                }
            };

            const getClickHandler =
                this.props.tableOptions && this.props.tableOptions.clickCallback
                    ? (value, rowValues, colValues) => {
                          const filters = {};
                          for (const i of Object.keys(colAttrs || {})) {
                              const attr = colAttrs[i];
                              if (colValues[i] !== null) {
                                  filters[attr] = colValues[i];
                              }
                          }
                          for (const i of Object.keys(rowAttrs || {})) {
                              const attr = rowAttrs[i];
                              if (rowValues[i] !== null) {
                                  filters[attr] = rowValues[i];
                              }
                          }
                          return e =>
                              this.props.tableOptions.clickCallback(
                                  e,
                                  value,
                                  filters,
                                  pivotData
                              );
                      }
                    : null;

            return (
                <table className="pvtTable">
                    <thead>
                        {colAttrs.map(function(c, j) {
                            return (
                                <tr key={`colAttr${j}`}>
                                    {j === 0 && rowAttrs.length !== 0 && (
                                        <th
                                            colSpan={rowAttrs.length}
                                            rowSpan={colAttrs.length}
                                        />
                                    )}
                                    <th className="pvtAxisLabel">{c}</th>
                                    {colKeys.map(function(colKey, i) {
                                        const x = spanSize(colKeys, i, j);
                                        if (x === -1) {
                                            return null;
                                        }
                                        // Multiple column attributes can be added to the pivot table, we only render
                                        // sort buttons for the last row of column headers
                                        const canSort =
                                            !!pivotData.props
                                                .enableColumnSorting &&
                                            !!colKey &&
                                            colKey.indexOf(colKey[j]) ===
                                                colKey.length - 1;

                                        return (
                                            <th
                                                className="pvtColLabel"
                                                key={`colKey${i}`}
                                                colSpan={x}
                                                rowSpan={
                                                    j === colAttrs.length - 1 &&
                                                    rowAttrs.length !== 0
                                                        ? 2
                                                        : 1
                                                }
                                            >
                                                <div className="pvtColLabelInner">
                                                    {colKey[j]}
                                                    {canSort && (
                                                        <button
                                                            className={getSortButtonClassNames(
                                                                colKey
                                                            )}
                                                            onClick={() =>
                                                                handleSortButtonClick(
                                                                    colKey
                                                                )
                                                            }
                                                        >
                                                            <span className="pvtColSortButton-asc-icon">
                                                                &#x25B2;
                                                            </span>
                                                            <span className="pvtColSortButton-desc-icon">
                                                                &#x25BC;
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}

                                    {j === 0 && (
                                        <th
                                            className="pvtTotalLabel"
                                            rowSpan={
                                                colAttrs.length +
                                                (rowAttrs.length === 0 ? 0 : 1)
                                            }
                                        >
                                            Totals
                                        </th>
                                    )}
                                </tr>
                            );
                        })}

                        {rowAttrs.length !== 0 && (
                            <tr>
                                {rowAttrs.map(function(r, i) {
                                    return (
                                        <th
                                            className="pvtAxisLabel"
                                            key={`rowAttr${i}`}
                                        >
                                            {r}
                                        </th>
                                    );
                                })}
                                <th className="pvtTotalLabel">
                                    {colAttrs.length === 0 ? 'Totals' : null}
                                </th>
                            </tr>
                        )}
                    </thead>

                    <tbody>
                        {rowKeys.map(function(rowKey, i) {
                            const totalAggregator = pivotData.getAggregator(
                                rowKey,
                                []
                            );
                            const totalFormatter =
                                valueFormatter || totalAggregator.format;

                            return (
                                <tr key={`rowKeyRow${i}`}>
                                    {rowKey.map(function(txt, j) {
                                        const x = spanSize(rowKeys, i, j);
                                        if (x === -1) {
                                            return null;
                                        }
                                        return (
                                            <th
                                                key={`rowKeyLabel${i}-${j}`}
                                                className="pvtRowLabel"
                                                rowSpan={x}
                                                colSpan={
                                                    j === rowAttrs.length - 1 &&
                                                    colAttrs.length !== 0
                                                        ? 2
                                                        : 1
                                                }
                                            >
                                                {txt}
                                            </th>
                                        );
                                    })}
                                    {colKeys.map(function(colKey, j) {
                                        const aggregator = pivotData.getAggregator(
                                            rowKey,
                                            colKey
                                        );
                                        const columnFormatter =
                                            valueFormatter || aggregator.format;

                                        return (
                                            <td
                                                className="pvtVal"
                                                key={`pvtVal${i}-${j}`}
                                                onClick={
                                                    getClickHandler &&
                                                    getClickHandler(
                                                        aggregator.value(),
                                                        rowKey,
                                                        colKey
                                                    )
                                                }
                                                style={valueCellColors(
                                                    rowKey,
                                                    colKey,
                                                    aggregator.value()
                                                )}
                                            >
                                                {columnFormatter(
                                                    aggregator.value()
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td
                                        className="pvtTotal"
                                        onClick={
                                            getClickHandler &&
                                            getClickHandler(
                                                totalAggregator.value(),
                                                rowKey,
                                                [null]
                                            )
                                        }
                                        style={colTotalColors(
                                            totalAggregator.value()
                                        )}
                                    >
                                        {totalFormatter(
                                            totalAggregator.value()
                                        )}
                                    </td>
                                </tr>
                            );
                        })}

                        <tr>
                            <th
                                className="pvtTotalLabel"
                                colSpan={
                                    rowAttrs.length +
                                    (colAttrs.length === 0 ? 0 : 1)
                                }
                            >
                                Totals
                            </th>

                            {colKeys.map(function(colKey, i) {
                                const totalAggregator = pivotData.getAggregator(
                                    [],
                                    colKey
                                );
                                return (
                                    <td
                                        className="pvtTotal"
                                        key={`total${i}`}
                                        onClick={
                                            getClickHandler &&
                                            getClickHandler(
                                                totalAggregator.value(),
                                                [null],
                                                colKey
                                            )
                                        }
                                        style={rowTotalColors(
                                            totalAggregator.value()
                                        )}
                                    >
                                        {totalAggregator.format(
                                            totalAggregator.value()
                                        )}
                                    </td>
                                );
                            })}

                            <td
                                onClick={
                                    getClickHandler &&
                                    getClickHandler(
                                        grandTotalAggregator.value(),
                                        [null],
                                        [null]
                                    )
                                }
                                className="pvtGrandTotal"
                            >
                                {grandTotalFormatter(
                                    grandTotalAggregator.value()
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>
            );
        }
    }

    TableRenderer.defaultProps = PivotData.defaultProps;
    TableRenderer.propTypes = PivotData.propTypes;
    TableRenderer.defaultProps.tableColorScaleGenerator = redColorScaleGenerator;
    TableRenderer.defaultProps.tableOptions = {};
    TableRenderer.propTypes.tableColorScaleGenerator = PropTypes.func;
    TableRenderer.propTypes.tableOptions = PropTypes.object;
    return TableRenderer;
}

class TSVExportRenderer extends React.PureComponent {
    render() {
        const pivotData = new PivotData(this.props);
        const rowKeys = pivotData.getRowKeys();
        const colKeys = pivotData.getColKeys();
        if (rowKeys.length === 0) {
            rowKeys.push([]);
        }
        if (colKeys.length === 0) {
            colKeys.push([]);
        }

        const headerRow = pivotData.props.rows.map(r => r);
        if (colKeys.length === 1 && colKeys[0].length === 0) {
            headerRow.push(this.props.aggregatorName);
        } else {
            colKeys.map(c => headerRow.push(c.join('-')));
        }

        const result = rowKeys.map(r => {
            const row = r.map(x => x);
            colKeys.map(c => {
                const v = pivotData.getAggregator(r, c).value();
                row.push(v ? v : '');
            });
            return row;
        });

        result.unshift(headerRow);

        return (
            <textarea
                value={result.map(r => r.join('\t')).join('\n')}
                style={{
                    width: window.innerWidth / 2,
                    height: window.innerHeight / 2
                }}
                readOnly={true}
            />
        );
    }
}

TSVExportRenderer.defaultProps = PivotData.defaultProps;
TSVExportRenderer.propTypes = PivotData.propTypes;

export default {
    Table: makeRenderer(),
    'Table Heatmap': makeRenderer({ heatmapMode: 'full' }),
    'Table Col Heatmap': makeRenderer({ heatmapMode: 'col' }),
    'Table Row Heatmap': makeRenderer({ heatmapMode: 'row' }),
    'Exportable TSV': TSVExportRenderer
};
