import React, {useState, useEffect} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import config from '../../config';
import './Comparison.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MaterialSelector = () => {
    const [element, setElement] = useState('');
    const [material, setMaterial] = useState('');
    const [precursor, setPrecursor] = useState('');
    const [coReactant, setCoReactant] = useState('');
    const [surface, setSurface] = useState('');

    const [pretreatment1, setPretreatment1] = useState('');
    const [publication1, setPublication1] = useState('');
    const [pretreatment2, setPretreatment2] = useState('');
    const [publication2, setPublication2] = useState('');

    const [materials, setMaterials] = useState([]);
    const [precursors, setPrecursors] = useState([]);
    const [coReactants, setCoReactants] = useState([]);
    const [surfaces, setSurfaces] = useState([]);
    const [pretreatments, setPretreatments] = useState([]);
    const [publications1, setPublications1] = useState([]);
    const [publications2, setPublications2] = useState([]);

    const [readings1, setReadings1] = useState([]);
    const [readings2, setReadings2] = useState([]);
    const [showChart, setShowChart] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();

    const API_BASE_URL = `${config.BACKEND_API_URL}/api`;

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const elementParam = params.get('element');
        if (elementParam) {
            setElement(elementParam);
            // Immediately fetch materials when element is set
            fetch(`${API_BASE_URL}/materials?element=${elementParam}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.length > 0) {
                        setMaterials(data);
                    } else {
                        console.error('No materials found for element:', elementParam);
                        navigate('/dashboard'); // Redirect if no data found
                    }
                })
                .catch(err => {
                    console.error('Error fetching materials:', err);
                    navigate('/dashboard'); // Redirect on error
                });
        } else {
            navigate('/dashboard'); // Redirect if no element parameter
        }
    }, [location, navigate]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/precursors?element=${element}&material=${material}`)
        .then(res => res.json())
        .then(data => {
            setPrecursors(data.precursors);
            setCoReactants(data.coReactants);
        })
        .catch(err => console.error('Error fetching precursors and coreactants:', err));
    }, [material, element]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/surfaces?element=${element}&material=${material}&precursor=${precursor}&coreactant=${coReactant}`)
        .then(res => res.json())
        .then(data => {
            setSurfaces(data.surfaces);
            setPretreatments(data.pretreatments);
        })
        .catch(err => console.error('Error fetching surfaces and pretreatments:', err));
    }, [precursor, coReactant, material, element]);

    useEffect(() => {
        if (!(surface && pretreatment1)) return;
        fetch(`${API_BASE_URL}/publications?element=${element}&material=${material}&precursor=${precursor}&coreactant=${coReactant}&surface=${surface}&pretreatment=${pretreatment1}`)
        .then(res => res.json())
        .then(data => setPublications1(data))
        .catch(err => console.error('Error fetching publications:', err));
    }, [surface, pretreatment1, material, precursor, coReactant, element]);

    useEffect(() => {
        if (!(surface && pretreatment2)) return;
        fetch(`${API_BASE_URL}/publications?element=${element}&material=${material}&precursor=${precursor}&coreactant=${coReactant}&surface=${surface}&pretreatment=${pretreatment2}`)
        .then(res => res.json())
        .then(data => setPublications2(data))
        .catch(err => console.error('Error fetching publications:', err));
    }, [surface, pretreatment2, material, precursor, coReactant, element]);

    const generateComparison = () => {
        if (!publication1 || !publication2) return;

        fetch(`${API_BASE_URL}/readings?element=${element}&material=${material}&precursor=${precursor}&coreactant=${coReactant}&surface=${surface}&pretreatment=${pretreatment1}&publication=${encodeURIComponent(publication1)}`)
        .then(res => res.json())
        .then(data => setReadings1(data))
        .catch(err => console.error('Error fetching readings1:', err));

        fetch(`${API_BASE_URL}/readings?element=${element}&material=${material}&precursor=${precursor}&coreactant=${coReactant}&surface=${surface}&pretreatment=${pretreatment2}&publication=${encodeURIComponent(publication2)}`)
        .then(res => res.json())
        .then(data => setReadings2(data))
        .catch(err => console.error('Error fetching readings2:', err));
        
        setShowChart(true);
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
            <div className='selector-container'>
                <div className='parameters-section'>
                    <h2>ASD Comparison</h2>
                    <div className='common-section'>
                        <label>Select Material:</label>
                        <select value={material} onChange={(e) => setMaterial(e.target.value)}>
                            <option value="">-- Select --</option>
                            {materials.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>

                        {material && (
                            <>
                                <label>Select Precursor:</label>
                                <select value={precursor} onChange={(e) => setPrecursor(e.target.value)}>
                                    <option value="">-- Select --</option>
                                    {precursors.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>

                                <label>Select Co-Reactant:</label>
                                <select value={coReactant} onChange={(e) => setCoReactant(e.target.value)}>
                                    <option value="">-- Select --</option>
                                    {coReactants.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </>
                        )}

                        {precursor && coReactant && (
                            <>
                                <label>Select Surface:</label>
                                <select value={surface} onChange={(e) => setSurface(e.target.value)}>
                                    <option value="">-- Select --</option>
                                    {surfaces.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </>
                        )}
                    </div>

                    {surface && (
                        <div className='experiment-section'>
                            <h3>Experiment 1</h3>
                            <label>Select Pre-treatment:</label>
                            <select value={pretreatment1} onChange={(e) => setPretreatment1(e.target.value)}>
                                <option value=">">-- Select --</option>
                                {pretreatments.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                            </select>

                            {pretreatment1 && (
                            <>
                                <label>Select Publication:</label>
                                {publications1.map((pub, idx) => (
                                    <div key={`exp1-${idx}`} className="radio-option">
                                        <input
                                            type="radio"
                                            id={`pub1-${idx}`}
                                            name="publication1"
                                            value={pub}
                                            checked={publication1 === pub}
                                            onChange={() => setPublication1(pub)}
                                        />
                                        <label htmlFor={`pub1-${idx}`}>{pub}</label>
                                    </div>
                                ))}
                            </>
                            )}
                        </div>
                    )}

                    {surface && (
                        <div className="experiment-section">
                            <h3>Experiment 2</h3>
                            <label>Select Pre-Treatment:</label>
                            <select value={pretreatment2} onChange={(e) => setPretreatment2(e.target.value)}>
                                <option value="">-- Select --</option>
                                {pretreatments.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                            </select>

                            {pretreatment2 && (
                                <>
                                    <label>Select Publication:</label>
                                    {publications2.map((pub, idx) => (
                                        <div key={`exp2-${idx}`} className="radio-option">
                                            <input
                                                type="radio"
                                                id={`pub2-${idx}`}
                                                name="publication2"
                                                value={pub}
                                                checked={publication2 === pub}
                                                onChange={() => setPublication2(pub)}
                                            />
                                            <label htmlFor={`pub2-${idx}`}>{pub}</label>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                    {publication1 && publication2 && (
                        <button className='compare-btn' onClick={generateComparison}>
                            Generate Comparison
                        </button>
                    )}
                </div>

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
                                <Line type="monotone" dataKey="thickness1" stroke='#8884d8' name='Experiment 1' dot={{fill: 'black', r: 4}} />
                                <Line type="monotone" dataKey="thickness2" stroke='#82ca9d' name='Experiment 2' dot={{fill: 'green', r: 4}} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </>
        
    )
};

export default MaterialSelector;