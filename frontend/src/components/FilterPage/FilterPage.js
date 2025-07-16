import React from "react";
import Navbar from "../Navbar/Navbar";
import "./FilterPage.css";

const FilterPage = ({ setUser, isAuthorized, user }) => {
  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} user={user} />
      <div className="filter-page-container">
        <h1>Filter Data</h1>
        <p>This page will allow advanced filtering of data in the future.</p>
      </div>
    </>
  );
};

export default FilterPage;
