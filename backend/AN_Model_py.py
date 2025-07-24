import numpy as np
import pandas as pd
from scipy.optimize import minimize
import time

# 1. Load data
# Assumes Data1.xlsx and Data2.xlsx are in the same directory
# Data1: columns = [cycle, thickness]
# Data2: columns = [cycle, thickness]

def run_an_model(growth, nongrowth):
    data1 = growth
    data2 = nongrowth

    growth = np.sum((data1[1:,1] - data1[:-1,1]) / (data1[1:,0] - data1[:-1,0]))
    gdot = growth / (len(data1) - 1)
    ncycles = int(data2[-1,0] * 1.5)

    best_V = {"V": None}

    # Vectorized AN_Model_py
    def AN_Model_py(gdot, nhat, ndot0, td, ncycles, Data2):
        rmax = ncycles + 1
        V = np.zeros((rmax, 12))
        V[0,0] = 1
        V[0,4] = 1
        V[0,6] = 1
        V[0,9] = nhat
        A0 = 1
        # Vectorized thickness on growth surface
        t_arr = np.arange(0, rmax)
        V[:,0] = t_arr + 1
        V[:,1] = t_arr
        V[:,2] = gdot * t_arr
        # Vectorized fractional surface coverage on non-growth area
        t_pos = t_arr[1:]
        AextNhat = A0 * np.pi * (gdot * t_pos)**2 * nhat
        if ndot0 == 0:
            AextNdot = np.zeros_like(t_pos)
        else:
            # Vectorized sum over tau for each t
            tau_idx = np.arange(rmax)
            T, TAU = np.meshgrid(t_pos, tau_idx, indexing='ij')
            delta = gdot * (T - TAU)
            delta[delta < 0] = 0
            if td == 0:
                dAextNdot = A0 * ndot0 * np.pi * delta**2
            else:
                with np.errstate(divide='ignore', invalid='ignore'):
                    dAextNdot = A0 * ndot0 * np.exp(-td/(T-TAU+1e-12)) * np.pi * delta**2
                    dAextNdot[(T-TAU)<0] = 0
            AextNdot = np.sum(dAextNdot, axis=1)
        V[1:,5] = 1 - np.exp(-(AextNhat + AextNdot))
        # Nucleation site density (still needs recurrence, but vectorized for ndot0=0)
        V[1,9] = nhat
        if ndot0 == 0:
            V[2:,9] = nhat
        else:
            for t in range(2, rmax):
                exp_term = np.exp(-td/t) if t != 0 else 0
                V[t,9] = V[t-1,9] + (ndot0 * exp_term * (1 - V[t,5]))
        # Average particle radius
        with np.errstate(divide='ignore', invalid='ignore'):
            mask = V[:,9] > 0
            particle_area = np.zeros(rmax)
            particle_area[mask] = V[mask,5] / V[mask,9]
            V[mask,11] = np.sqrt(particle_area[mask] / np.pi)
        # Vectorized thickness calculation (ndot0=0 case)
        # For ndot0=0, AextNdoth is always zero, so only AextNhath matters
        if ndot0 == 0:
            for t in range(1, rmax):
                stp = np.arange(0, t+1)
                AextNhath = A0 * np.pi * ((gdot * t)**2 - (gdot * stp)**2) * nhat
                V[t,3] = np.sum((1 - np.exp(-AextNhath)) * gdot)
        else:
            for t in range(1, rmax):
                for stp in range(0, t+1):
                    AextNhath = A0 * np.pi * ((gdot * t)**2 - (gdot * stp)**2) * nhat
                    AextNdoth = 0
                    for tau in range(0, t+1):
                        delta = (gdot * (t-tau))**2 - (gdot * stp)**2
                        if delta >= 0 and td == 0:
                            dAextNdoth = A0 * ndot0 * np.pi * delta
                        elif delta >= 0:
                            exp_term = np.exp(-td/tau) if tau != 0 else 0
                            dAextNdoth = A0 * ndot0 * exp_term * np.pi * delta
                        else:
                            dAextNdoth = 0
                        AextNdoth += dAextNdoth
                    V[t,3] += (1 - np.exp(-(AextNhath + AextNdoth))) * gdot
        with np.errstate(divide='ignore', invalid='ignore'):
            V[:,4] = np.where((V[:,2] + V[:,3]) != 0, (V[:,2] - V[:,3]) / (V[:,2] + V[:,3]), 0)
            V[:,6] = np.where((1 + V[:,5]) != 0, (1 - V[:,5]) / (1 + V[:,5]), 0)
            V[1:,10] = V[1:,3] - V[:-1,3]
        # RMSE calculation
        model_cycles = V[:,1]
        model_thickness = V[:,3]
        rmse_sum = 0
        count = 0
        for i in range(Data2.shape[0]):
            cycle = Data2[i,0]
            thickness = Data2[i,1]
            idx = np.argmin(np.abs(model_cycles - cycle))
            model_val = model_thickness[idx]
            rmse_sum += (thickness - model_val)**2
            count += 1
        rmse = np.sqrt(rmse_sum / count) if count > 0 else 1e6
        return rmse, V

    # 4. Define the objective function for optimization
    def objective(nhat):
        rmse, V = AN_Model_py(gdot, nhat[0], ndot0=0, td=0, ncycles=ncycles, Data2=data2)
        if best_V["V"] is None or rmse < best_V.get("best_rmse", float("inf")):
            best_V["V"] = V.copy()
            best_V["best_rmse"] = rmse
        return rmse

    # 5. Optimize nhat to minimize RMSE
    start_time = time.perf_counter()
    res = minimize(objective, x0=[0.05], bounds=[(1e-8, 1.0)], method='L-BFGS-B')
    end_time = time.perf_counter()

    final_nhat = res.x[0]
    V = best_V["V"]

    model_x = V[:, 1].tolist()
    model_nongrowth_y = V[:, 3].tolist()
    model_growth_y = V[:, 2].tolist()

    print(f'Fitting completed in {end_time - start_time:.1f} seconds.')
    print(f'Final nhat value = {final_nhat:.3e}.') 
    
    return {
        "final_nhat": float(final_nhat),
        "growth": data1.tolist(),
        "nongrowth": data2.tolist(),
        "model_x": model_x,
        "model_nongrowth_y": model_nongrowth_y,
        "model_growth_y": model_growth_y
    }