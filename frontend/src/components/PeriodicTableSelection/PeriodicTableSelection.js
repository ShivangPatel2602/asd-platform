import React from "react";
import { useParams } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import PeriodicTable from "../PeriodicTable/PeriodicTable";

const typeToEndpoint = {
  material: "elements-with-data",
  surface: "surfaces-with-data",
};

const typeToTitle = {
  material: "Select a Material",
  surface: "Select a Surface",
};

const PeriodicTableSelection = ({ setUser, isAuthorized, user }) => {
  const { type } = useParams();

  const endpoint = typeToEndpoint[type] || typeToEndpoint.material;
  const title = typeToTitle[type] || typeToTitle.material;

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} user={user} />
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 32 }}>
        <h2 style={{ textAlign: "center", marginBottom: 32 }}>{title}</h2>
        <PeriodicTable type={type} endpoint={endpoint} />
      </div>
    </>
  );
};

export default PeriodicTableSelection;
