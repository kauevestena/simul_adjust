// app.js

window.CESIUM_BASE_URL = 'https://unpkg.com/cesium@1.116.0/Build/Cesium';

console.log('Initializing Cesium Viewer...');
const viewer = new Cesium.Viewer('cesiumContainer', {
    imageryProvider: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: true,
    infoBox: true,
    navigationHelpButton: false,
    sceneModePicker: false,
    animation: true,
    timeline: true,
    fullscreenButton: true,
    requestRenderMode: false
});

Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
    { enablePickFeatures: false }
).then(provider => {
    viewer.imageryLayers.addImageryProvider(provider);
}).catch(err => {
    console.error('Error loading imagery:', err);
});

console.log('Viewer initialized.');

viewer.scene.highDynamicRange = true;
viewer.clock.shouldAnimate = true;

// TODO: Create a GitHub Action to automatically fetch and update this serialized gnss.txt file periodically.
const TLE_URL = 'gnss.txt';
const satellites = [];
let showOrbits = true;

const constellationVisibility = {
    'GPS': true,
    'GLONASS': true,
    'Galileo': true,
    'BeiDou': true,
    'Other': false
};

const satCountEl = document.getElementById('satCount');
const satListEl = document.getElementById('satList');
const toggleOrbitsEl = document.getElementById('toggleOrbits');

toggleOrbitsEl.addEventListener('change', (e) => {
    showOrbits = e.target.checked;
    viewer.entities.values.forEach(entity => {
        if (entity.polyline) {
            entity.polyline.show = showOrbits;
        }
    });
});

async function fetchTLEData() {
    console.log('Fetching TLE data...');
    try {
        const response = await fetch(TLE_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.text();
        console.log(`Fetched ${data.length} bytes of TLE data.`);
        parseTLE(data);
    } catch (error) {
        console.error('Error fetching TLE data:', error);
        satListEl.innerHTML = '<li style="color:#ff6b6b">Error loading data. Check console.</li>';
    }
}

function parseTLE(tleData) {
    const lines = tleData.split('\n').map(line => line.trim());
    let constCounts = {};

    for (let i = 0; i < lines.length; i += 3) {
        if (lines[i] && lines[i + 1] && lines[i + 2]) {
            const name = lines[i].replace(/^0 /, '').trim();
            const tleLine1 = lines[i + 1];
            const tleLine2 = lines[i + 2];
            
            let satrec;
            try {
                satrec = satellite.twoline2satrec(tleLine1, tleLine2);
            } catch(e) {
                console.error('Failed to parse TLE for', name, e);
                continue;
            }
            
            let constellation = 'Other';
            if (name.includes('GPS') || name.includes('NAVSTAR')) constellation = 'GPS';
            else if (name.includes('GLONASS') || name.includes('COSMOS')) constellation = 'GLONASS';
            else if (name.includes('GSAT') || name.includes('GALILEO')) constellation = 'Galileo';
            else if (name.includes('BEIDOU')) constellation = 'BeiDou';

            constCounts[constellation] = (constCounts[constellation] || 0) + 1;

            satellites.push({ name, satrec, constellation });
        }
    }

    satCountEl.innerText = satellites.length;
    renderSatellites();
    updateUIList(constCounts);
}

function renderSatellites() {
    const now = Cesium.JulianDate.now();
    const start = Cesium.JulianDate.addHours(now, -12, new Cesium.JulianDate());
    const stop = Cesium.JulianDate.addHours(now, 12, new Cesium.JulianDate());
    
    viewer.clock.startTime = start.clone();
    viewer.clock.stopTime = stop.clone();
    viewer.clock.currentTime = now.clone();
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewer.clock.multiplier = 50; 

    const stepMin = 10; 
    
    satellites.forEach(sat => {
        let color = Cesium.Color.WHITE;
        if (sat.constellation === 'GPS') color = Cesium.Color.DODGERBLUE;
        else if (sat.constellation === 'GLONASS') color = Cesium.Color.CRIMSON;
        else if (sat.constellation === 'Galileo') color = Cesium.Color.GOLD;
        else if (sat.constellation === 'BeiDou') color = Cesium.Color.SPRINGGREEN;

        const positionProperty = new Cesium.SampledPositionProperty();
        const orbitPositions = [];
        
        for (let j = -12 * 60; j <= 12 * 60; j += stepMin) {
            const time = new Date(Date.now() + j * 60 * 1000);
            const positionAndVelocity = satellite.propagate(sat.satrec, time);
            
            if (positionAndVelocity.position && !isNaN(positionAndVelocity.position.x)) {
                const positionEci = positionAndVelocity.position;
                const gmst = satellite.gstime(time);
                const positionGd = satellite.eciToGeodetic(positionEci, gmst);
                
                const longitude = positionGd.longitude;
                const latitude = positionGd.latitude;
                const height = positionGd.height * 1000;
                
                const cartesian = Cesium.Cartesian3.fromRadians(longitude, latitude, height);
                orbitPositions.push(cartesian);
                
                const julianDate = Cesium.JulianDate.fromDate(time);
                positionProperty.addSample(julianDate, cartesian);
            }
        }

        if (orbitPositions.length > 0) {
            const entity = viewer.entities.add({
                name: sat.name,
                description: `Constellation: ${sat.constellation}`,
                position: positionProperty,
                show: constellationVisibility[sat.constellation] !== false, // Defaults to true if not defined
                point: {
                    pixelSize: 8,
                    color: color,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 1
                },
                label: {
                    text: sat.name,
                    font: '12px Inter, sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(0, -15),
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 40000000.0) 
                },
                polyline: {
                    positions: orbitPositions,
                    width: 1,
                    material: color.withAlpha(0.4),
                    show: showOrbits
                }
            });
            sat.entity = entity;
        }
    });
}

function updateUIList(constCounts) {
    satListEl.innerHTML = '';
    
    const colors = {
        'GPS': '#1e90ff',
        'GLONASS': '#dc143c',
        'Galileo': '#ffd700',
        'BeiDou': '#00ff7f',
        'Other': '#ffffff'
    };

    for (const [constellation, count] of Object.entries(constCounts)) {
        const li = document.createElement('li');
        const isChecked = constellationVisibility[constellation] !== false ? 'checked' : '';
        
        li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="display: flex; align-items: center; cursor: pointer; flex-grow: 1; user-select: none;">
                    <input type="checkbox" data-constel="${constellation}" ${isChecked} style="margin-right: 8px; cursor: pointer;">
                    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${colors[constellation] || '#fff'}; margin-right:8px;"></span>
                    ${constellation}
                </label>
                <strong>${count}</strong>
            </div>
        `;
        satListEl.appendChild(li);
    }

    satListEl.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const constel = e.target.getAttribute('data-constel');
            constellationVisibility[constel] = e.target.checked;
            
            satellites.forEach(sat => {
                if (sat.constellation === constel && sat.entity) {
                    sat.entity.show = constellationVisibility[constel];
                }
            });
        });
    });
}

fetchTLEData();
