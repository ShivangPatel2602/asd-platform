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

    const [readings1, setReadings1] = useState([]);
    const [readings2, setReadings2] = useState([]);
    const [showChart, setShowChart] = useState(false);
    const [error, setError] = useState('');

    const [isLoading, setIsLoading] = useState(true);

    const [readings, setReadings] = useState({});

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

    const handleRowSelect = (row, index) => {
        setError('');

        const isSelected = selectedRows.includes(index);
        if (isSelected) {
            setSelectedRows(selectedRows.filter(i => i !== index));
                if (selectedRows[0] === index) {
                    setReadings1([]);
                } else {
                    setReadings2([]);
                }
        } else {
            setSelectedRows([...selectedRows, index]);
            if (row.publications.length === 1) {
            handlePublicationSelect(index, row.publications[0]);
        }
        }
    };

    const handlePublicationSelect = (rowIndex, publication) => {
        setSelectedPublications({
        ...selectedPublications,
        [rowIndex]: publication
        });
    
        const row = elementData[rowIndex];
        if (!selectedRows.includes(rowIndex)) {
            setSelectedRows([...selectedRows, rowIndex]);
        }
        fetchDataForRow(row, publication, selectedRows.length === 0 ? 1 : 2);
    };

    const fetchDataForRow = (row, publication, rowIndex) => {
    fetch(`${API_BASE_URL}/readings?element=${element}&material=${row.material}&precursor=${row.precursor}&coreactant=${row.coreactant}&surface=${row.surface}&pretreatment=${row.pretreatment}&publication=${encodeURIComponent(publication)}`)
        .then(res => res.json())
        .then(data => {
            setReadings(prev => ({
                ...prev,
                [rowIndex]: data
            }));
            setShowChart(true);
        })
        .catch(err => {
            console.error('Error fetching readings:', err);
            setError('Failed to fetch reading data');
        });
};

    const generateComparison = () => {
        if (selectedRows.length !== 2) return;

        const row1 = elementData[selectedRows[0]];
        const row2 = elementData[selectedRows[1]];

        const pub1 = row1.publications.length > 1 ? selectedPublications[selectedRows[0]] : row1.publications[0];
        const pub2 = row2.publications.length > 1 ? selectedPublications[selectedRows[1]] : row2.publications[0];

        Promise.all([
        fetch(`${API_BASE_URL}/readings?element=${element}&material=${row1.material}&precursor=${row1.precursor}&coreactant=${row1.coreactant}&surface=${row1.surface}&pretreatment=${row1.pretreatment}&publication=${encodeURIComponent(pub1)}`),
        fetch(`${API_BASE_URL}/readings?element=${element}&material=${row2.material}&precursor=${row2.precursor}&coreactant=${row2.coreactant}&surface=${row2.surface}&pretreatment=${row2.pretreatment}&publication=${encodeURIComponent(pub2)}`)
        ])
        .then(([res1, res2]) => Promise.all([res1.json(), res2.json()]))
        .then(([data1, data2]) => {
            console.log('Received data:', { data1, data2 });
            setReadings1(data1);
            setReadings2(data2);
            setShowChart(true);
        })
        .catch(err => {
            console.error('Error fetching readings:', err);
            setError('Failed to fetch reading data');
        });
    }

    const PublicationCell = ({ publications, index, onSelect }) => {
        if (publications.length > 5) {
            return (
                <select 
                    value={selectedPublications[index] || ''}
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
                        className={`publication-tag ${selectedPublications[index] === pub ? 'selected' : ''}`}
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
    const step = maxCycle <= 100 ? 5 : 10;

    const uniformCycles = Array.from(
        { length: Math.floor(maxCycle / step) + 1 },
        (_, i) => i * step
    );

    return uniformCycles.map(cycle => {
        const point = { cycle };
        Object.entries(readings).forEach(([rowIndex, rowReadings]) => {
            const reading = rowReadings.find(r => r.cycles === cycle);
            point[`thickness_${rowIndex}`] = reading?.thickness ?? null;
        });
        return point;
    }).filter(point => Object.keys(point).some(key => key.startsWith('thickness_') && point[key] !== null));
    }

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
                                <div className='chart-container'>
                                    <h3>Cycle vs Thickness</h3>
                                    <ResponsiveContainer width="100%" aspect={1}>
                                        <LineChart 
                                            data={combinedData()} 
                                            margin={{top: 20, right: 30, left: 20, bottom: 20}}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis 
                                                dataKey="cycle"
                                                type="number"
                                                domain={calculateAxisRanges().cycleDomain}
                                                ticks={Array.from(
                                                    { length: Math.floor(calculateAxisRanges().cycleDomain[1] / calculateAxisRanges().cycleInterval) + 1 },
                                                    (_, i) => i * calculateAxisRanges().cycleInterval
                                                )}
                                                label={{ value: 'Number of Cycles', position: 'bottom', offset: 0 }}
                                            />
                                            <YAxis 
                                                label={{value: 'Thickness (nm)', angle: -90, position: 'insideLeft', offset: 10}}
                                                domain={calculateAxisRanges().thicknessDomain}
                                                ticks={Array.from(
                                                    { length: Math.floor(calculateAxisRanges().thicknessDomain[1] / calculateAxisRanges().thicknessInterval) + 1 },
                                                    (_, i) => i * calculateAxisRanges().thicknessInterval
                                                )}
                                            />
                                            <Tooltip 
                                                formatter={(value) => value !== null ? `${value} nm` : 'No data'}
                                                labelFormatter={(value) => `Cycle: ${value}`}
                                            />
                                            <Legend />
                                            {selectedRows.map((rowIndex, i) => {
        const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FFBB28'];
        return (
            <Line 
                key={rowIndex}
                type="monotone" 
                dataKey={`thickness_${rowIndex}`} 
                stroke={colors[i % colors.length]}
                name={`${elementData[rowIndex].surface} (${selectedPublications[rowIndex] || elementData[rowIndex].publications[0]})`}
                dot={{fill: colors[i % colors.length], r: 4}}
                connectNulls={false}
            />
        );
    })}
                                        </LineChart>
                                    </ResponsiveContainer>
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