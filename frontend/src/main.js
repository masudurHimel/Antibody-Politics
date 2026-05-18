import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";
const savedTheme = localStorage.getItem("theme") ?? "dark";
document.documentElement.setAttribute("data-theme", savedTheme);
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
