#%% Section 1: Package imports
import numpy as np
import pandas as pd
from scipy.optimize import minimize
import time
from concurrent.futures import ProcessPoolExecutor
from numba import njit, prange
import plotly.graph_objects as go
import plotly.express as px
import webbrowser
import tempfile
import gc

#%% Section 2: Scenario fitting function and class construction
# Top-level fitting function to be executed in parallel
def run_fit(scenario):
    rmse = scenario.fit()
    return scenario.name, {
        'rmse': rmse,
        'params': scenario.result.x,
        'fun': scenario.result.fun,
        'V': scenario.best_V
    }

# Class for fitting scenarios
class FitScenario:
    def __init__(self, name, param_bounds, param_flags, gdot, ncycles, data2):
        self.name = name
        self.param_bounds = param_bounds
        self.param_flags = param_flags
        self.active_params = [k for k, v in param_flags.items() if v]
        self.gdot = gdot
        self.ncycles = ncycles
        self.data2 = data2
        self.result = None
        self.best_V = None

    def objective(self, params):
        param_dict = dict(zip(self.active_params, params))
        
        # Enforce defaults when parameter is inactive
        nhat = param_dict.get('nhat', 0.0)
        ndot0 = param_dict.get('ndot0', 0.0)
        td = int(param_dict.get('td', 0))  # Must be int, and 0 if inactive
        
        rmse, V = AN_Model_py(
            self.gdot, nhat, ndot0, td, self.ncycles, self.data2, return_V=True
        )
        self.best_V = V
        return rmse

    def fit(self):
        # Better initial guesses for faster convergence
        x0 = []
        for (low, high) in self.param_bounds:
            if low == 0:
                x0.append(1e-6)
            else:
                # Use geometric mean for better initial guess
                x0.append(np.sqrt(low * high))
        
        self.result = minimize(
            self.objective, 
            x0, 
            bounds=self.param_bounds, 
            method='TNC',
            options={'maxfun': 100}  # Keep your original iterations
        )
        return self.result.fun

# Class wrapper to select scenarios and run fitting process
class ScenarioSelector:
    def __init__(self, scenarios):
        self.scenarios = scenarios
        self.results = {}

    def run_all(self):
        with ProcessPoolExecutor(max_workers=4) as executor:
            futures = executor.map(run_fit, self.scenarios)
            self.results = dict(futures)

    def get_best(self, zero_tol=1e-8):
        nonzero_results = {
            name: result for name, result in self.results.items()
            if all(np.abs(p) > zero_tol for p in result['params'])
        }
        
        if nonzero_results:
            return min(nonzero_results.items(), key=lambda item: item[1]['rmse'])
        else:
            # Fall back if all parameters are zero or near-zero
            print("Warning: All scenarios have zero or near-zero parameters; returning lowest RMSE overall.")
            return min(self.results.items(), key=lambda item: item[1]['rmse'])

#%% Section 3: Computation functions
# Parallelized, JIT-compiled kernel function using Numba
@njit(parallel=True, fastmath=True, cache=True)
def _compute_dV_kernel(nhat, ndot0, td, gdot, rmax, A0, exp_decay_lookup):
    r = np.arange(1, rmax)
    dV_accum = np.zeros((rmax - 1, rmax))

    for t_idx in prange(rmax - 1):  # Keep prange as in your original
        t = r[t_idx]
        t2 = t * t
        for s in range(rmax):
            if s <= t:
                stp2 = s * s
                AextNhath = A0 * np.pi * gdot * gdot * (t2 - stp2) * nhat

                AextNdoth = 0.0
                for tau in range(t+1):
                    delta = gdot * gdot * ((t - tau) ** 2 - s ** 2)
                    if delta >= 0.0:
                        dA = A0 * ndot0 * np.pi * delta
                        if td > 0.0:
                            dA *= exp_decay_lookup[tau]
                        AextNdoth += dA

                AextTotal = AextNhath + AextNdoth
                dV_accum[t_idx, s] = (1.0 - np.exp(-AextTotal)) * gdot

    return dV_accum

# Python wrapper for Numba kernel function
def compute_dV_matrix(nhat, ndot0, td, gdot, rmax, A0):
    exp_decay_lookup = np.zeros(rmax)
    if td > 0.0:
        for tau in range(1, rmax):
            exp_decay_lookup[tau] = np.exp(-td / tau)

    return _compute_dV_kernel(nhat, ndot0, td, gdot, rmax, A0, exp_decay_lookup)

# Python vectorized function to carry out core calculation logic
def AN_Model_py(gdot, nhat, ndot0, td, ncycles, data2, return_V=False):
    rmax = ncycles + 1
    V = np.zeros((rmax, 12))
    V[0, 0] = 1
    V[0, 4] = 1
    V[0, 6] = 1
    V[0, 9] = nhat
    A0 = 1

    t_arr = np.arange(0, rmax)
    V[:, 0] = t_arr + 1
    V[:, 1] = t_arr
    V[:, 2] = gdot * t_arr

    # Surface coverage calculation
    t_pos = t_arr[1:]
    AextNhat = A0 * np.pi * (gdot * t_pos)**2 * nhat
    if ndot0 == 0:
        AextNdot = np.zeros_like(t_pos)
    else:
        tau_idx = np.arange(rmax)
        T, TAU = np.meshgrid(t_pos, tau_idx, indexing='ij')
        delta = gdot * (T - TAU)
        delta[delta < 0] = 0
        if td == 0:
            dAextNdot = A0 * ndot0 * np.pi * delta**2
        else:
            with np.errstate(divide='ignore', invalid='ignore'):
                dAextNdot = A0 * ndot0 * np.exp(-td / (T - TAU)) * np.pi * delta**2
                dAextNdot[(T - TAU) < 0] = 0
        AextNdot = np.sum(dAextNdot, axis=1)

    V[1:, 5] = 1 - np.exp(-(AextNhat + AextNdot))

    # Nucleation site density
    V[1, 9] = nhat
    if ndot0 == 0:
        V[2:, 9] = nhat
    else:
        for t in range(2, rmax):
            exp_term = np.exp(-td / t) if t != 0 else 0
            V[t, 9] = V[t - 1, 9] + (ndot0 * exp_term * (1 - V[t, 5]))

    # Particle radius
    with np.errstate(divide='ignore', invalid='ignore'):
        mask = V[:, 9] > 0
        particle_area = np.zeros(rmax)
        particle_area[mask] = V[mask, 5] / V[mask, 9]
        V[mask, 11] = np.sqrt(particle_area[mask] / np.pi)

    # Thickness calculation
    if ndot0 == 0:
        for t in range(1, rmax):
            stp = np.arange(0, t + 1)
            AextNhath = A0 * np.pi * ((gdot * t)**2 - (gdot * stp)**2) * nhat
            V[t, 3] = np.sum((1 - np.exp(-AextNhath)) * gdot)
    else:
        dV = compute_dV_matrix(nhat, ndot0, td, gdot, rmax, A0)
        V[1:, 3] = np.sum(dV, axis=1)

    # Calculations for selectivity fractions and nucleus density
    with np.errstate(divide='ignore', invalid='ignore'):
        V[:, 4] = np.where((V[:, 2] + V[:, 3]) != 0,
                           (V[:, 2] - V[:, 3]) / (V[:, 2] + V[:, 3]), 0)
        V[:, 6] = np.where((1 + V[:, 5]) != 0,
                           (1 - V[:, 5]) / (1 + V[:, 5]), 0)
        V[1:, 10] = V[1:, 3] - V[:-1, 3]

    # RMSE calculation
    model_cycles = V[:, 1]
    model_thickness = V[:, 3]
    rmse_sum = 0
    count = 0
    for i in range(data2.shape[0]):
        cycle = data2[i, 0]
        thickness = data2[i, 1]
        idx = np.argmin(np.abs(model_cycles - cycle))
        model_val = model_thickness[idx]
        rmse_sum += (thickness - model_val)**2
        count += 1
    rmse = np.sqrt(rmse_sum / count) if count > 0 else 1e6

    return (rmse, V) if return_V else rmse

# Function to run the model with frontend data
def run_an_model(growth, nongrowth):
    """
    Run the vectorized model with multiple scenarios and return the best fit results
    """
    try:
        # Calculate growth rate and cycles from the input data
        data1 = np.array(growth)  # growth surface data
        data2 = np.array(nongrowth)  # non-growth surface data
        
        growth_rate = np.sum(np.diff(data1[:, 1]) / np.diff(data1[:, 0]))
        gdot = growth_rate / (len(data1) - 1)
        ncycles = int(data2[-1, 0] * 1.5)
        
        # Construct scenarios with different combinations of independent variables
        # In run_an_model, update scenarios with tighter bounds:
        scenarios = [
            FitScenario(
                "nhat only",
                param_bounds=[(1e-8, 1e-1)],  # Keep your original bounds
                param_flags={'nhat': True, 'ndot0': False, 'td': False},
                gdot=gdot, ncycles=ncycles, data2=data2
            ),
            FitScenario(
                "ndot0 only",
                param_bounds=[(1e-8, 1e-1)],
                param_flags={'nhat': False, 'ndot0': True, 'td': False},
                gdot=gdot, ncycles=ncycles, data2=data2
            ),
            FitScenario(
                "ndot0 and td",
                param_bounds=[(1e-8, 1e-1), (1, int(ncycles/4))],  # Tighter td bounds
                param_flags={'nhat': False, 'ndot0': True, 'td': True},
                gdot=gdot, ncycles=ncycles, data2=data2
            ),
            FitScenario(
                "nhat and ndot0",
                param_bounds=[(1e-8, 1e-1), (1e-8, 1e-1)],
                param_flags={'nhat': True, 'ndot0': True, 'td': False},
                gdot=gdot, ncycles=ncycles, data2=data2
            ),
            FitScenario(
                "nhat + ndot0 + td",
                param_bounds=[(1e-8, 1e-1), (1e-8, 1e-1), (1, int(ncycles/4))],  # Tighter td bounds
                param_flags={'nhat': True, 'ndot0': True, 'td': True},
                gdot=gdot, ncycles=ncycles, data2=data2
            )
        ]
        
        # Run all scenarios
        selector = ScenarioSelector(scenarios)
        selector.run_all()
        
        # Get the best scenario
        best_name, best_result = selector.get_best()
        best_V = best_result['V']
        
        # Prepare data for frontend
        model_x = best_V[:, 1].tolist()  # cycles
        model_growth_y = best_V[:, 2].tolist()  # growth surface thickness
        model_nongrowth_y = best_V[:, 3].tolist()  # non-growth surface thickness
        
        # Get all scenario results for comparison
        scenario_results = {}
        for name, result in selector.results.items():
            V = result['V']
            scenario_results[name] = {
                'rmse': float(result['rmse']),
                'params': result['params'].tolist(),
                'model_x': V[:, 1].tolist(),
                'model_growth_y': V[:, 2].tolist(),
                'model_nongrowth_y': V[:, 3].tolist()
            }
        
        return {
            "best_scenario": best_name,
            "best_rmse": float(best_result['rmse']),
            "best_params": best_result['params'].tolist(),
            "growth": data1.tolist(),  # Original growth data
            "nongrowth": data2.tolist(),  # Original nongrowth data
            "model_x": model_x,
            "model_growth_y": model_growth_y,
            "model_nongrowth_y": model_nongrowth_y,
            "all_scenarios": scenario_results
        }
    except Exception as e:
        print(f"Model error: {e}")
        return {
            "error": f"Computation failed: {str(e)}",
            "best_scenario": "error",
            "best_rmse": float('inf'),
            "growth": data1.tolist() if 'data1' in locals() else [],
            "nongrowth": data2.tolist() if 'data2' in locals() else [],
            "model_x": [],
            "model_growth_y": [],
            "model_nongrowth_y": [],
            "all_scenarios": {}
        }
    finally:
        if len(gc.get_objects()) > 10000:
            gc.collect()