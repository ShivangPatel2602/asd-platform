import {useEffect, useState} from 'react';

function App() {
  const [backendData, setBackendData] = useState(null);

  useEffect(() => {
    fetch("http://localhost:5000/api/health")
    .then((res) => res.json())
    .then((data) => setBackendData(data.status));
  }, []);

  return (
    <div style={{padding: "2rem"}}>
      <h1>ASD Platform</h1>
      <p>{backendData ? backendData : "Loading backend status..."}</p>
    </div>
  );
}

export default App;