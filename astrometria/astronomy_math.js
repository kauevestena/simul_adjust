// Astronomy Math Utility

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

class AstronomyMath {
    /**
     * Compute Greenwich Mean Sidereal Time (GMST) in degrees for a given UTC Date.
     */
    static getGMST(date) {
        // Compute Julian Day
        const JD = this.getJulianDate(date);
        const T = (JD - 2451545.0) / 36525.0;
        
        // GMST in degrees
        let gmst = 280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000.0;
        
        return this.normalizeAngle(gmst);
    }

    /**
     * Get Julian Date from a JS Date object
     */
    static getJulianDate(date) {
        return (date.getTime() / 86400000) + 2440587.5;
    }

    /**
     * Normalize an angle to [0, 360)
     */
    static normalizeAngle(angle) {
        let a = angle % 360;
        if (a < 0) a += 360;
        return a;
    }

    /**
     * Convert Equatorial (RA, Dec) to Horizontal (Alt, Az)
     * ra: Right Ascension (degrees)
     * dec: Declination (degrees)
     * lat: Latitude (degrees)
     * lon: Longitude (degrees)
     * gmst: Greenwich Sidereal Time (degrees)
     */
    static equatorialToHorizontal(ra, dec, lat, lon, gmst) {
        // Local Sidereal Time
        const lst = this.normalizeAngle(gmst + lon);
        
        // Hour Angle
        const ha = this.normalizeAngle(lst - ra);
        
        const haRad = ha * DEG_TO_RAD;
        const decRad = dec * DEG_TO_RAD;
        const latRad = lat * DEG_TO_RAD;

        // Altitude
        const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
        const altRad = Math.asin(sinAlt);
        const alt = altRad * RAD_TO_DEG;

        // Azimuth
        let cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(altRad));
        // clamp due to float precision
        cosAz = Math.max(-1, Math.min(1, cosAz));
        let azRad = Math.acos(cosAz);
        
        let az = azRad * RAD_TO_DEG;
        
        if (Math.sin(haRad) > 0) {
            az = 360 - az;
        }

        return { alt, az };
    }

    /**
     * Format a decimal angle to DD°MM'SS"
     */
    static formatAngle(decimal, isRA = false) {
        const sign = decimal < 0 ? "-" : (isRA ? "" : "+");
        decimal = Math.abs(decimal);
        
        if (isRA) {
            // RA is often given in Hours, but here we expect degrees so divide by 15
            decimal = decimal / 15;
            const h = Math.floor(decimal);
            const m = Math.floor((decimal - h) * 60);
            const s = Math.round((decimal - h - m/60) * 3600);
            return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
        }

        const d = Math.floor(decimal);
        const m = Math.floor((decimal - d) * 60);
        const s = Math.round((decimal - d - m/60) * 3600);
        
        return `${sign}${d}° ${m.toString().padStart(2, '0')}' ${s.toString().padStart(2, '0')}"`;
    }

    /**
     * Least Squares Adjustment to find Lat, Lon, and Azimuth Constant
     * observations: Array of { ra, dec, observedZenith (deg), observedRelativeAz (deg), time (Date) }
     * returns: { lat, lon, azimuthConstant }
     */
    static calculatePosition(observations) {
        // Initial guess (e.g., 0,0 or we could get clever, but let's start at 0,0 for simplicity)
        // Wait, if the user can be anywhere, 0,0 might not converge well. 
        // We will start at Lat = 0, Lon = 0, AzConst = 0
        let lat = 0;
        let lon = 0;
        let azConst = 0; // True Azimuth = Relative Azimuth + azConst

        // We will do a few iterations of Marcq St Hilaire (position line) or general non-linear least squares
        for (let iter = 0; iter < 10; iter++) {
            const A = []; // Jacobian
            const L = []; // Residuals

            observations.forEach(obs => {
                const gmst = this.getGMST(obs.time);
                // Compute calculated Alt/Az from current guess
                const calc = this.equatorialToHorizontal(obs.ra, obs.dec, lat, lon, gmst);
                
                const calcZenith = 90 - calc.alt; // Zenith distance
                const calcAz = calc.az;

                // Residuals (Observed - Calculated)
                const dZ = obs.observedZenith - calcZenith;
                
                // Azimuth difference (wrap around 360 properly)
                let dAz = obs.observedRelativeAz + azConst - calcAz;
                dAz = this.normalizeAngle(dAz + 180) - 180; // between -180 and 180

                // Jacobian elements (Partial derivatives)
                // dZ / dLat = -cos(Az)
                // dZ / dLon = -cos(Lat) * sin(Az)
                const dZ_dLat = -Math.cos(calcAz * DEG_TO_RAD);
                const dZ_dLon = -Math.cos(lat * DEG_TO_RAD) * Math.sin(calcAz * DEG_TO_RAD);
                
                // dAz / dLat = sin(Az) / tan(Z)
                // dAz / dLon = sin(Lat) - cos(Lat) * cos(Az) / tan(Z)
                const tanZ = Math.tan(calcZenith * DEG_TO_RAD) || 0.001;
                const dAz_dLat = Math.sin(calcAz * DEG_TO_RAD) / tanZ;
                const dAz_dLon = Math.sin(lat * DEG_TO_RAD) - (Math.cos(lat * DEG_TO_RAD) * Math.cos(calcAz * DEG_TO_RAD)) / tanZ;

                // Add to matrices. We have 2 equations per observation (Zenith and Azimuth)
                A.push([dZ_dLat, dZ_dLon, 0]);
                L.push([dZ]);

                A.push([dAz_dLat, dAz_dLon, 1]);
                L.push([dAz]);
            });

            // Solve normal equations: dX = (A^T * A)^-1 * A^T * L
            const AT = mathTranspose(A);
            const ATA = mathMultiply(AT, A);
            const ATL = mathMultiply(AT, L);
            
            const dx = solveLinearSystem(ATA, ATL);
            
            if (!dx) break; // Singular matrix or error

            lat += dx[0][0];
            lon += dx[1][0];
            azConst += dx[2][0];

            // Normalize
            lon = this.normalizeAngle(lon + 180) - 180;
            if (lat > 90) lat = 180 - lat;
            if (lat < -90) lat = -180 - lat;
            azConst = this.normalizeAngle(azConst);

            // Check convergence
            if (Math.abs(dx[0][0]) < 1e-6 && Math.abs(dx[1][0]) < 1e-6 && Math.abs(dx[2][0]) < 1e-6) {
                break;
            }
        }

        return { lat, lon, azimuthConstant: azConst };
    }
}

// Simple matrix math helpers for 3x3 systems
function mathTranspose(A) {
    return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
}

function mathMultiply(A, B) {
    const result = new Array(A.length).fill(0).map(() => new Array(B[0].length).fill(0));
    for (let r = 0; r < A.length; ++r) {
        for (let c = 0; c < B[0].length; ++c) {
            for (let i = 0; i < A[0].length; ++i) {
                result[r][c] += A[r][i] * B[i][c];
            }
        }
    }
    return result;
}

// Gaussian elimination for small systems
function solveLinearSystem(A, B) {
    const n = A.length;
    // Create augmented matrix
    const M = A.map((row, i) => [...row, B[i][0]]);
    
    for (let i = 0; i < n; i++) {
        // Find pivot
        let maxEl = Math.abs(M[i][i]);
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(M[k][i]) > maxEl) {
                maxEl = Math.abs(M[k][i]);
                maxRow = k;
            }
        }

        // Swap maximum row with current row
        const temp = M[maxRow];
        M[maxRow] = M[i];
        M[i] = temp;

        // Make all rows below this one 0 in current column
        for (let k = i + 1; k < n; k++) {
            const c = -M[k][i] / M[i][i];
            for (let j = i; j < n + 1; j++) {
                if (i === j) M[k][j] = 0;
                else M[k][j] += c * M[i][j];
            }
        }
    }

    // Solve equation for an upper triangular matrix
    const x = new Array(n).fill(0);
    for (let i = n - 1; i > -1; i--) {
        x[i] = M[i][n] / M[i][i];
        for (let k = i - 1; k > -1; k--) {
            M[k][n] -= M[k][i] * x[i];
        }
    }
    
    return x.map(val => [val]);
}
