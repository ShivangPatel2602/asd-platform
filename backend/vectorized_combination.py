#%% Section 1: Package imports
import numpy as np
import pandas as pd
from scipy.optimize import minimize
from numba import njit, prange
import time
import gc
import warnings
warnings.filterwarnings('ignore')

#%% Section 2: Numba-optimized core functions (preserving exact vc.py logic)

@njit(parallel=True, fastmath=True, cache=True)
def _compute_dV_kernel_exact(nhat, ndot0, td, gdot, rmax, A0, exp_decay_lookup):
    """Exact replication of vc.py compute_dV_kernel with Numba optimization"""
    r = np.arange(1, rmax)
    dV_accum = np.zeros((rmax - 1, rmax))

    for t_idx in prange(rmax - 1):
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

def compute_dV_matrix_exact(nhat, ndot0, td, gdot, rmax, A0):
    """Exact replication of vc.py compute_dV_matrix"""
    exp_decay_lookup = np.zeros(rmax)
    if td > 0.0:
        for tau in range(1, rmax):
            exp_decay_lookup[tau] = np.exp(-td / tau)

    return _compute_dV_kernel_exact(nhat, ndot0, td, gdot, rmax, A0, exp_decay_lookup)

#%% Section 3: Model function (exact vc.py logic with optimizations)

def AN_Model_py_vc_exact(gdot, nhat, ndot0, td, ncycles, data2, return_V=False):
    """
    Exact replication of vc.py AN_Model_py function with performance optimizations
    """
    try:
        rmax = ncycles + 1
        V = np.zeros((rmax, 12))
        
        # Exact initialization from vc.py
        V[0, 0] = 1
        V[0, 4] = 1
        V[0, 6] = 1
        V[0, 9] = nhat
        A0 = 1

        t_arr = np.arange(0, rmax)
        V[:, 0] = t_arr + 1
        V[:, 1] = t_arr
        V[:, 2] = gdot * t_arr

        # Surface coverage calculation - exact vc.py logic
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

        # Nucleation site density - exact vc.py logic
        V[1, 9] = nhat
        if ndot0 == 0:
            V[2:, 9] = nhat
        else:
            for t in range(2, rmax):
                exp_term = np.exp(-td / t) if t != 0 else 0
                V[t, 9] = V[t - 1, 9] + (ndot0 * exp_term * (1 - V[t, 5]))

        # Particle radius - exact vc.py logic
        with np.errstate(divide='ignore', invalid='ignore'):
            mask = V[:, 9] > 0
            particle_area = np.zeros(rmax)
            particle_area[mask] = V[mask, 5] / V[mask, 9]
            V[mask, 11] = np.sqrt(particle_area[mask] / np.pi)

        # Thickness calculation - exact vc.py logic
        if ndot0 == 0:
            for t in range(1, rmax):
                stp = np.arange(0, t + 1)
                AextNhath = A0 * np.pi * ((gdot * t)**2 - (gdot * stp)**2) * nhat
                V[t, 3] = np.sum((1 - np.exp(-AextNhath)) * gdot)
        else:
            dV = compute_dV_matrix_exact(nhat, ndot0, td, gdot, rmax, A0)
            V[1:, 3] = np.sum(dV, axis=1)

        # Calculations for selectivity fractions and nucleus density - exact vc.py logic
        with np.errstate(divide='ignore', invalid='ignore'):
            V[:, 4] = np.where((V[:, 2] + V[:, 3]) != 0,
                               (V[:, 2] - V[:, 3]) / (V[:, 2] + V[:, 3]), 0)
            V[:, 6] = np.where((1 + V[:, 5]) != 0,
                               (1 - V[:, 5]) / (1 + V[:, 5]), 0)
            V[1:, 10] = V[1:, 3] - V[:-1, 3]

        # RMSE calculation - exact vc.py logic
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

        if not np.isfinite(rmse):
            rmse = 1e6

        return (rmse, V) if return_V else rmse

    except Exception as e:
        print(f"Model computation error: {e}")
        return (1e6, None) if return_V else 1e6

#%% Section 4: Optimized fitting classes (preserving vc.py logic)

class FitScenarioVCExact:
    """Exact replication of vc.py FitScenario with optimizations"""
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
        
        # Enforce defaults when parameter is inactive - exact vc.py logic
        nhat = param_dict.get('nhat', 0.0)
        ndot0 = param_dict.get('ndot0', 0.0)
        td = int(param_dict.get('td', 0))  # Must be int, and 0 if inactive
        
        rmse, V = AN_Model_py_vc_exact(
            self.gdot, nhat, ndot0, td, self.ncycles, self.data2, return_V=True
        )
        self.best_V = V
        return rmse

    def fit(self):
        # Exact vc.py initial guess logic
        x0 = [(low + high) // 2 for (low, high) in self.param_bounds]
        
        # Use TNC method like vc.py but with some optimizations
        self.result = minimize(
            self.objective, 
            x0, 
            bounds=self.param_bounds, 
            method='TNC',
            options={
                'maxfun': 300,  # Slightly increased for better convergence
                'ftol': 1e-8,   # Better precision
                'xtol': 1e-8    # Better parameter precision
            }
        )
        return self.result.fun  # RMSE

def run_fit_vc_exact(scenario):
    """Exact replication of vc.py run_fit"""
    try:
        rmse = scenario.fit()
        return scenario.name, {
            'rmse': rmse,
            'params': scenario.result.x,
            'fun': scenario.result.fun,
            'V': scenario.best_V
        }
    except Exception as e:
        print(f"Error in scenario {scenario.name}: {e}")
        return scenario.name, {
            'rmse': float('inf'),
            'params': np.array([]),
            'fun': float('inf'),
            'V': None
        }

class ScenarioSelectorVCExact:
    """Exact replication of vc.py ScenarioSelector but with sequential execution"""
    def __init__(self, scenarios):
        self.scenarios = scenarios
        self.results = {}

    def run_all(self):
        """Sequential execution for debugging (can be made parallel later)"""
        for i, scenario in enumerate(self.scenarios):
            print(f"Running scenario {i+1}/{len(self.scenarios)}: {scenario.name}")
            start_time = time.time()
            
            name, result = run_fit_vc_exact(scenario)
            self.results[name] = result
            
            elapsed = time.time() - start_time
            print(f"  Completed in {elapsed:.1f}s, RMSE: {result['rmse']:.4e}")
            
            gc.collect()

    def get_best(self, zero_tol=1e-8):
        """Exact replication of vc.py get_best logic"""
        try:
            nonzero_results = {
                name: result for name, result in self.results.items()
                if (result.get('params') is not None and 
                    hasattr(result['params'], '__len__') and
                    len(result['params']) > 0 and
                    all(np.abs(p) > zero_tol for p in result['params']))
            }
            
            if nonzero_results:
                return min(nonzero_results.items(), key=lambda item: item[1]['rmse'])
            else:
                # Fall back if all parameters are zero or near-zero
                print("Warning: All scenarios have zero or near-zero parameters; returning lowest RMSE overall.")
                valid_results = {name: result for name, result in self.results.items() 
                               if result.get('rmse') is not None and np.isfinite(result['rmse'])}
                if valid_results:
                    return min(valid_results.items(), key=lambda item: item[1]['rmse'])
                else:
                    return None, None
                    
        except Exception as e:
            print(f"Error in get_best: {e}")
            return None, None

#%% Section 5: Main function (exact vc.py logic with optimizations)

def run_an_model_vc_exact(growth, nongrowth):
    """
    Exact replication of vc.py main logic with optimizations
    """
    try:
        start_time = time.time()
        
        # Convert to exact same format as vc.py
        data1 = np.array(growth, dtype=np.float64)
        data2 = np.array(nongrowth, dtype=np.float64)
        
        if len(data1) < 2:
            raise ValueError("Growth data must have at least 2 points")
        
        # Exact same parameter calculation as vc.py
        growth = np.sum((data1[1:,1] - data1[:-1,1]) / (data1[1:,0] - data1[:-1,0]))
        gdot = growth / (len(data1) - 1)
        ncycles = int(data2[-1,0] * 1.5)
        
        print(f"Parameters: gdot={gdot:.6f}, ncycles={ncycles}")
        
        # Exact same scenarios as vc.py
        scenarios = [
            FitScenarioVCExact(
                "nhat only",
                param_bounds=[(0, 1e-1)],
                param_flags={'nhat': True, 'ndot0': False, 'td': False},
                gdot=gdot, ncycles=ncycles, data2=data2
            ),
            FitScenarioVCExact(
                "ndot0 only",
                param_bounds=[(0, 1e-1)],
                param_flags={'nhat': False, 'ndot0': True, 'td': False},
                gdot=gdot, ncycles=ncycles, data2=data2
            ),
            FitScenarioVCExact(
                "ndot0 and td",
                param_bounds=[(0, 1e-1), (0, int(ncycles/2))],
                param_flags={'nhat': False, 'ndot0': True, 'td': True},
                gdot=gdot, ncycles=ncycles, data2=data2
            ),
            FitScenarioVCExact(
                "nhat and ndot0",
                param_bounds=[(0, 1e-1), (0, 1e-1)],
                param_flags={'nhat': True, 'ndot0': True, 'td': False},
                gdot=gdot, ncycles=ncycles, data2=data2
            ),
            FitScenarioVCExact(
                "nhat + ndot0 + td",
                param_bounds=[(0, 1e-1), (0, 1e-1), (0, int(ncycles/2))],
                param_flags={'nhat': True, 'ndot0': True, 'td': True},
                gdot=gdot, ncycles=ncycles, data2=data2
            )
        ]
        
        print(f"Running {len(scenarios)} scenarios...")
        
        # Run scenarios
        selector = ScenarioSelectorVCExact(scenarios)
        selector.run_all()
        
        # Get best result - exact vc.py logic
        best_result = selector.get_best()
        if best_result is None or best_result[0] is None:
            raise ValueError("No valid scenarios found")
        
        best_name, best_data = best_result
        best_V = best_data.get('V')
        
        if best_V is None:
            raise ValueError("Best scenario returned no results")
        
        print(f"Best scenario: {best_name} (RMSE: {best_data['rmse']:.4e})")
        
        # Print detailed results like vc.py
        for name, result in selector.results.items():
            print(f"Scenario: {name}")
            print(f"  RMSE: {result['rmse']:.4e}")
            print(f"  Params: {result['params']}")
            
            # Print sample V matrix like vc.py
            V = result['V']
            if V is not None:
                print("  Sample of V matrix (Cycle, Growth Thickness, Non-Growth Coverage):")
                for i in range(0, V.shape[0], max(1, V.shape[0] // 10)):
                    cycle = int(V[i,1])
                    thickness_growth = V[i,2]
                    thickness_nongrowth = V[i,3]
                    coverage_nongrowth = V[i,5]
                    print(f"    Cycle {cycle:3d}: Growth = {thickness_growth:.4f}, Non-Growth = {thickness_nongrowth:.4f}, Coverage = {coverage_nongrowth:.4f}")
            print()
        
        # Prepare results
        model_x = best_V[:, 1].tolist()
        model_growth_y = best_V[:, 2].tolist()
        model_nongrowth_y = best_V[:, 3].tolist()
        
        # Get scenario results
        scenario_results = {}
        for name, result in selector.results.items():
            try:
                if result.get('V') is not None and result.get('params') is not None:
                    params = result['params']
                    if hasattr(params, '__len__') and len(params) > 0:
                        V = result['V']
                        scenario_results[name] = {
                            'rmse': float(result['rmse']),
                            'params': params.tolist() if hasattr(params, 'tolist') else list(params),
                            'model_x': V[:, 1].tolist(),
                            'model_growth_y': V[:, 2].tolist(),
                            'model_nongrowth_y': V[:, 3].tolist()
                        }
            except Exception as e:
                print(f"Error processing scenario {name}: {e}")
                continue
        
        elapsed_time = time.time() - start_time
        print(f"Total computation time: {elapsed_time:.1f} seconds")
        
        # Clean up
        del selector, scenarios
        gc.collect()

        return {
            "best_scenario": best_name,
            "best_rmse": float(best_data.get('rmse', float('inf'))),
            "best_params": (best_data.get('params').tolist() if hasattr(best_data.get('params'), 'tolist') 
                          else list(best_data.get('params', []))),
            "growth": data1.tolist(),
            "nongrowth": data2.tolist(),
            "model_x": model_x,
            "model_growth_y": model_growth_y,
            "model_nongrowth_y": model_nongrowth_y,
            "all_scenarios": scenario_results,
            "computation_time": elapsed_time
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
            "all_scenarios": {},
            "computation_time": 0
        }

# Alias for compatibility
run_an_model = run_an_model_vc_exact