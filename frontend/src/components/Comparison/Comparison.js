import React, {useState, useEffect} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from "../Navbar/Navbar";
import config from '../../config';
import './Comparison.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MaterialSelector = ({setUser}) => {
    const [element, setElement] = useState('');
    const [elementData, setElementData] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);
    const [selectedPublications, setSelectedPublications] = useState({});
    const [showChart, setShowChart] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [readings, setReadings] = useState({});
    const [selectivityData, setSelectivityData] = useState([]);

    const location = useLocation();
    const navigate = useNavigate();

    const API_BASE_URL = `${config.BACKEND_API_URL}/api`;

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const elementParam = params.get('element');
        if (elementParam) {
            setElement(elementParam);
            setIsLoading(true);
            fetch(`${API_BASE_URL}/element-data?element=${elementParam}`)
                .then(res => res.json())
                .then(data => {
                    if (data.length === 0) {
                        setError('no-data');
                    } else {
                        setElementData(data);
                    }
                })
                .catch(err => {
                    console.error('Error fetching materials:', err);
                    navigate('/dashboard');
                })
                .finally(() => {
                    setIsLoading(false);
                })
        } else {
            navigate('/dashboard'); // Redirect if no element parameter
        }
    }, [location, navigate]);

    const handlePublicationSelect = (rowIndex, publication) => {
        setSelectedPublications(prev => {
            const currentSelected = prev[rowIndex] || [];
            const isAlreadySelected = currentSelected.includes(publication);
            
            if (isAlreadySelected) {
                const newSelected = currentSelected.filter(pub => pub !== publication);
                const compositeKey = `${rowIndex}-${publication}`;
                setReadings(prevReadings => {
                    const { [compositeKey]: removed, ...rest } = prevReadings;
                    return rest;
                });
                
                if (newSelected.length === 0) {
                    const { [rowIndex]: _, ...rest } = prev;
                    return rest;
                }
                return { ...prev, [rowIndex]: newSelected };
            }
            
            return {
                ...prev,
                [rowIndex]: [...currentSelected, publication]
            };
        });

        if (!selectedPublications[rowIndex]?.includes(publication)) {
            const row = elementData[rowIndex];
            const compositeKey = `${rowIndex}-${publication}`;
            fetchDataForRow(row, publication, compositeKey);
        }
    };

    const fetchDataForRow = (row, publication, compositeKey) => {
        fetch(`${API_BASE_URL}/readings?element=${element}&material=${row.material}&precursor=${row.precursor}&coreactant=${row.coreactant}&surface=${row.surface}&pretreatment=${row.pretreatment}&publication=${encodeURIComponent(publication)}`)
            .then(res => res.json())
            .then(data => {
                setReadings(prev => ({
                    ...prev,
                    [compositeKey]: data
                }));
                setShowChart(true);
            })
            .catch(err => {
                console.error('Error fetching readings:', err);
                setError('Failed to fetch reading data');
            });
    };

    const PublicationCell = ({ publications, index, onSelect }) => {
        if (publications.length > 5) {
            return (
                <select 
                    value={selectedPublications[index]?.[0] || ''}
                    onChange={(e) => onSelect(index, e.target.value)}
                    className="publication-select"
                >
                    <option value="">Select Publication</option>
                    {publications.map((pub, i) => (
                        <option key={i} value={pub}>{pub}</option>
                    ))}
                </select>
            );
        }

        return (
            <div className="publications-list">
                {publications.map((pub, i) => (
                    <span 
                        key={i}
                        className={`publication-tag ${selectedPublications[index]?.includes(pub) ? 'selected' : ''}`}
                        onClick={() => onSelect(index, pub)}
                    >
                        {pub}
                    </span>
                ))}
            </div>
        );
    };

    const handleClearSelections = () => {
        setSelectedRows([]);
    setSelectedPublications({});
    setReadings({});
    setShowChart(false);
    };

    const calculateAxisRanges = () => {
        const allReadings = Object.values(readings).flat();
    const allCycles = allReadings.map(r => r.cycles);
    const allThickness = allReadings.map(r => r.thickness);
    
    const maxCycle = Math.max(...allCycles);
    const maxThickness = Math.max(...allThickness);
    
    const cycleInterval = maxCycle <= 100 ? 10 : maxCycle <= 200 ? 20 : 50;
    const thicknessInterval = Math.ceil(maxThickness / 10);
    
    const cycleDomain = [0, Math.ceil(maxCycle / cycleInterval) * cycleInterval];
    const thicknessDomain = [0, Math.ceil(maxThickness / thicknessInterval) * thicknessInterval];
    
    return {
        cycleInterval,
        thicknessInterval,
        cycleDomain,
        thicknessDomain
    };
    };

    const combinedData = () => {
        if (Object.keys(readings).length === 0) return [];

        const allReadings = Object.values(readings).flat();
        const maxCycle = Math.max(...allReadings.map(r => r.cycles));
        const minCycle = Math.min(...allReadings.map(r => r.cycles));
        const step = maxCycle <= 100 ? 5 : 10;

        const uniformCycles = Array.from(
            { length: Math.floor((maxCycle - minCycle) / step) + 1 },
            (_, i) => minCycle + (i * step)
        );

        const interpolateValue = (cycle, readings) => {
            const before = [...readings].reverse().find(r => r.cycles <= cycle);
            const after = readings.find(r => r.cycles >= cycle);

            if (before?.cycles === cycle) return before.thickness;
            if (after?.cycles === cycle) return after.thickness;

            if (before && after) {
                const ratio = (cycle - before.cycles) / (after.cycles - before.cycles);
                return before.thickness + (ratio * (after.thickness - before.thickness));
            }

            return null;
        };

        return uniformCycles.map(cycle => {
            const point = { cycle };
            Object.entries(readings).forEach(([compositeKey, rowReadings]) => {
                if (Array.isArray(rowReadings) && rowReadings.length > 0) {
                    const minDataCycle = Math.min(...rowReadings.map(r => r.cycles));
                    const maxDataCycle = Math.max(...rowReadings.map(r => r.cycles));
                    
                    if (cycle >= minDataCycle && cycle <= maxDataCycle) {
                        point[compositeKey] = interpolateValue(cycle, rowReadings);
                    } else {
                        point[compositeKey] = null;
                    }
                }
            });
            return point;
        }).filter(point => 
            Object.keys(point).some(key => 
                key !== 'cycle' && point[key] !== null
            )
        );
    }

    const renderLines = () => {
        return Object.entries(readings).map(([compositeKey, rowReadings], i) => {
            const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FFBB28'];
            const [rowIndex, publication] = compositeKey.split('-');
            
            const actualPoints = rowReadings.map(r => r.cycles);
            
            return (
                <Line 
                    key={compositeKey}
                    type="monotone" 
                    dataKey={compositeKey} 
                    stroke={colors[i % colors.length]}
                    name={`${elementData[rowIndex].surface} (${publication})`}
                    dot={(props) => {
                        if (actualPoints.includes(props.payload.cycle)) {
                            return (
                                <circle 
                                    cx={props.cx} 
                                    cy={props.cy} 
                                    r={4} 
                                    fill={colors[i % colors.length]}
                                />
                            );
                        }
                        return null;
                    }}
                    connectNulls={true}
                    activeDot={{ r: 6, strokeWidth: 2 }}
                    strokeWidth={2}
                />
            );
        });
    };

    const calculateSelectivity = () => {
        const selectedReadings = Object.values(readings);
        
        if (selectedReadings.length !== 2) {
            setSelectivityData([]);
            return;
        }

        const [data1, data2] = selectedReadings;
        const selectivityPoints = [];

        const cycles1 = new Set(data1.map(r => r.cycles));
        const cycles2 = new Set(data2.map(r => r.cycles));
        const commonCycles = [...cycles1].filter(cycle => cycles2.has(cycle));

        commonCycles.forEach(cycle => {
            const t1 = data1.find(r => r.cycles === cycle)?.thickness;
            const t2 = data2.find(r => r.cycles === cycle)?.thickness;
            
            if (t1 != null && t2 != null) {
                selectivityPoints.push({
                    cycle,
                    thickness: Math.max(t1, t2),
                    selectivity: Math.abs(t1 - t2) / (t1 + t2)
                });
            }
        });

        setSelectivityData(selectivityPoints);
    };

    useEffect(() => {
        calculateSelectivity();
    }, [readings]);

    return (
        <>
            <Navbar setUser={setUser} />
            <div className='comparison-container'>
                <h2>Data for {element}</h2>
                
                {isLoading ? (
                    <div className="loading-container">
                        <div className="loading-content">
                            <div className="loading-spinner"></div>
                            <p>Loading data...</p>
                        </div>
                    </div>
                ) : error === 'no-data' ? (
                    <div className="no-data-container">
                        <div className="no-data-content">
                            <div className="no-data-icon">📊</div>
                            <h3>No Data Available</h3>
                            <p>There is currently no data available for {element}.</p>
                            <p>Would you like to contribute by adding some data?</p>
                            <button 
                                className="upload-redirect-button"
                                onClick={() => navigate('/upload-data')}
                            >
                                <span>⬆️</span>
                                Upload Data
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className='error-message'>
                                <span className='error-icon'>⚠️</span>
                                {error}
                            </div>
                        )}
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th>Precursor</th>
                                        <th>Co-reactant</th>
                                        <th>Surface</th>
                                        <th>Pretreatment</th>
                                        <th>Publications</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {elementData.map((row, index) => (
                                        <tr key={index} className={selectedRows.includes(index) ? 'selected' : ''}>
                                            <td>{row.material}</td>
                                            <td>{row.precursor}</td>
                                            <td>{row.coreactant}</td>
                                            <td>{row.surface}</td>
                                            <td>{row.pretreatment}</td>
                                            <td>
                                                <PublicationCell 
                                                    publications={row.publications}
                                                    index={index}
                                                    onSelect={handlePublicationSelect}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {showChart && (
                            <>
                                <div className="clear-button-container">
                                    <button 
                                        className="clear-button"
                                        onClick={handleClearSelections}
                                    >
                                        <span>🗑️</span>
                                        Clear Choices
                                    </button>
                                </div>
                                <div className='charts-wrapper'>
                                    <div className='chart-container'>
                                        <h3>Cycle vs Thickness</h3>
                                        <ResponsiveContainer width="100%" aspect={1}>
                                            <LineChart 
                                                data={combinedData()} 
                                                margin={{top: 20, right: 110, left: 20, bottom: 20}}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" strokeWidth={1.5} />
                                                <XAxis 
                                                    dataKey="cycle"
                                                    type="number"
                                                    domain={calculateAxisRanges().cycleDomain}
                                                    ticks={Array.from(
                                                        { length: Math.floor(calculateAxisRanges().cycleDomain[1] / calculateAxisRanges().cycleInterval) + 1 },
                                                        (_, i) => i * calculateAxisRanges().cycleInterval
                                                    )}
                                                    label={{ value: 'Number of Cycles', position: 'bottom', offset: 0 }}
                                                    stroke='#666'
                                                    strokeWidth={2}
                                                    tick={{fontSize: 12, fontWeight: 500}}
                                                />
                                                <YAxis 
                                                    label={{value: 'Thickness (nm)', angle: -90, position: 'insideLeft', offset: 10}}
                                                    domain={calculateAxisRanges().thicknessDomain}
                                                    stroke='#666'
                                                    strokeWidth={2}
                                                    tick={{fontSize: 12, fontWeight: 500}}
                                                    ticks={Array.from(
                                                        { length: Math.floor(calculateAxisRanges().thicknessDomain[1] / calculateAxisRanges().thicknessInterval) + 1 },
                                                        (_, i) => i * calculateAxisRanges().thicknessInterval
                                                    )}
                                                />
                                                <Tooltip 
                                                    formatter={(value) => value !== null ? `${value} nm` : 'No data'}
                                                    labelFormatter={(value) => `Cycle: ${value}`}
                                                />
                                                <Legend 
                                                    layout='vertical'
                                                    align='right'
                                                    verticalAlign='middle'                                            
                                                />
                                                {renderLines()}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                    {selectivityData.length > 0 && (
                                        <div className='chart-container'>
                                            <h3>Selectivity</h3>
                                            <ResponsiveContainer width="100%" aspect={1}>
                                                <LineChart 
                                                    data={selectivityData}
                                                    margin={{top: 20, right: 30, left: 20, bottom: 20}}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" strokeWidth={1.5} />
                                                    <XAxis 
                                                        dataKey="thickness"
                                                        type="number"
                                                        stroke='#666'
                                                        strokeWidth={2}
                                                        tick={{fontSize: 12, fontWeight: 500}}
                                                        label={{ value: 'Thickness of Thicker Film (nm)', position: 'bottom', offset: 0 }}
                                                    />
                                                    <YAxis
                                                        stroke='#666'
                                                        strokeWidth={2}
                                                        tick={{fontSize: 12, fontWeight: 500}}
                                                        label={{value: 'Selectivity', angle: -90, position: 'insideLeft', offset: 10}}
                                                        domain={[0, 1]}
                                                    />
                                                    <Tooltip 
                                                        formatter={(value) => value.toFixed(3)}
                                                        labelFormatter={(value) => `Cycle: ${value}`}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="selectivity"
                                                        stroke="#ff7300"
                                                        dot={{fill: '#ff7300', r: 4}}
                                                        connectNulls={true}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </>        
    )
};

export default MaterialSelector;