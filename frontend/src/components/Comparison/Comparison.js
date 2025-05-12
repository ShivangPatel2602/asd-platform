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

        if (selectedRows.length < 2 && 
            row.publications.length > 1 && 
            !selectedPublications[index]) {
            setError('Please select a publication first');
            return;
        }

        if (selectedRows.includes(index)) {
            const newSelection = selectedRows.filter(i => i !== index);
            setSelectedRows(newSelection);
            if (newSelection.length < 2) {
                setShowChart(false);
                setReadings1([]);
                setReadings2([]);
            }
            return;
        }

        if (selectedRows.length === 2) {
            setError('You can only select two rows for comparison');
            return;
        }

        if (selectedRows.length === 1) {
            const firstRow = elementData[selectedRows[0]];
            if (firstRow.surface === row.surface) {
                setError('Selected rows must have different surfaces');
                return;
            }
            if (firstRow.material !== row.material || 
                firstRow.precursor !== row.precursor || 
                firstRow.coreactant !== row.coreactant || 
                firstRow.pretreatment !== row.pretreatment) {
                setError('Selected rows must have same material, precursor, coreactant, and pretreatment');
                return;
            }
        }

        setSelectedRows([...selectedRows, index]);
    };

    const handlePublicationSelect = (rowIndex, publication) => {
        setSelectedPublications({
            ...selectedPublications,
            [rowIndex]: publication
        });
    };

    const generateComparison = () => {
        if (selectedRows.length !== 2) return;

        const row1 = elementData[selectedRows[0]];
        const row2 = elementData[selectedRows[1]];
        const pub1 = selectedPublications[selectedRows[0]];
        const pub2 = selectedPublications[selectedRows[1]];

        Promise.all([
            fetch(`${API_BASE_URL}/readings?element=${element}&material=${row1.material}&precursor=${row1.precursor}&coreactant=${row1.coreactant}&surface=${row1.surface}&pretreatment=${row1.pretreatment}&publication=${encodeURIComponent(pub1)}`),
            fetch(`${API_BASE_URL}/readings?element=${element}&material=${row2.material}&precursor=${row2.precursor}&coreactant=${row2.coreactant}&surface=${row2.surface}&pretreatment=${row2.pretreatment}&publication=${encodeURIComponent(pub2)}`)
        ])
        .then(([res1, res2]) => Promise.all([res1.json(), res2.json()]))
        .then(([data1, data2]) => {
            setReadings1(data1);
            setReadings2(data2);
            setShowChart(true);
        })
        .catch(err => console.error('Error fetching readings:', err));
    }

    const combinedData = () => {
        const minCycle = 0;
        const maxCycle = 600;
        const step = 10;

        const uniformCycles = [];
        for (let i = minCycle; i <= maxCycle; i += step) {
            uniformCycles.push(i);
        }

        // Map the uniform cycles to the data
        return uniformCycles.map(cycle => ({
            cycle,
            thickness1: readings1.find(r => r.cycles === cycle)?.thickness ?? null,
            thickness2: readings2.find(r => r.cycles === cycle)?.thickness ?? null,
        }));
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
                                        <th>Select</th>
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
                                                {row.publications.length > 1 ? (
                                                    <select 
                                                        value={selectedPublications[index] || ''}
                                                        onChange={(e) => handlePublicationSelect(index, e.target.value)}
                                                    >
                                                        <option value="">Select Publication</option>
                                                        {row.publications.map((pub, i) => (
                                                            <option key={i} value={pub}>{pub}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    row.publications[0]
                                                )}
                                            </td>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRows.includes(index)}
                                                    onChange={() => handleRowSelect(row, index)}
                                                    disabled={selectedRows.length === 2 && !selectedRows.includes(index)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {selectedRows.length === 2 && (
                        <button 
                            className="plot-button"
                            onClick={generateComparison}
                            disabled={selectedRows.some(index => 
                                elementData[index].publications.length > 1 && !selectedPublications[index]
                            )}
                        >
                            Plot Comparison
                        </button>
                        )}

                        {showChart && (
                            <div className='chart-container'>
                                <h3>Cycle vs Thickness</h3>
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={combinedData()} margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="cycle" />
                                        <YAxis label={{value: 'Thickness (nm)', angle: -90, position: 'insideLeft'}} />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="thickness1" stroke='#8884d8' name='Surface 1' dot={{fill: 'black', r: 4}} />
                                        <Line type="monotone" dataKey="thickness2" stroke='#82ca9d' name='Surface 2' dot={{fill: 'green', r: 4}} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>        
    )
};

export default MaterialSelector;