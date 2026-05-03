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
let showLOS = true;
let receiverPoint = null;
let receiverCartesian = null;
let receiverGd = null;
const losEntities = {};

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
const toggleLOSEl = document.getElementById('toggleLOS');
const gdopValueEl = document.getElementById('gdopValue');
const hdopValueEl = document.getElementById('hdopValue');
const vdopValueEl = document.getElementById('vdopValue');
const receiverCoordsEl = document.getElementById('receiverCoords');
const inViewCountEl = document.getElementById('inViewCount');

toggleLOSEl.addEventListener('change', (e) => {
    showLOS = e.target.checked;
    viewer.entities.suspendEvents();
    Object.values(losEntities).forEach(entity => {
        if (entity.inViewFlag) entity.show = showLOS;
    });
    viewer.entities.resumeEvents();
});

toggleOrbitsEl.addEventListener('change', (e) => {
    showOrbits = e.target.checked;
    viewer.entities.suspendEvents();
    satellites.forEach(sat => {
        if (sat.entity && sat.entity.polyline) {
            sat.entity.polyline.show = showOrbits;
        }
    });
    viewer.entities.resumeEvents();
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
            
            viewer.entities.suspendEvents();
            satellites.forEach(sat => {
                if (sat.constellation === constel && sat.entity) {
                    sat.entity.show = constellationVisibility[constel];
                }
            });
            viewer.entities.resumeEvents();
        });
    });
}

const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction((click) => {
    const ray = viewer.camera.getPickRay(click.position);
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    
    if (cartesian) {
        if (!receiverPoint) {
            receiverPoint = viewer.entities.add({
                position: new Cesium.CallbackProperty(() => receiverCartesian, false),
                point: {
                    pixelSize: 12,
                    color: Cesium.Color.BLACK,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2
                },
                label: {
                    text: 'Receiver',
                    font: '14px Inter, sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(0, -20)
                }
            });
        }
        
        receiverCartesian = cartesian;
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        receiverGd = {
            longitude: cartographic.longitude,
            latitude: cartographic.latitude,
            height: cartographic.height / 1000 // satellite.js expects km
        };
        
        const lonDeg = Cesium.Math.toDegrees(cartographic.longitude).toFixed(4);
        const latDeg = Cesium.Math.toDegrees(cartographic.latitude).toFixed(4);
        receiverCoordsEl.innerText = `Lat: ${latDeg}°, Lon: ${lonDeg}°`;
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

viewer.clock.onTick.addEventListener((clock) => {
    if (!receiverGd) return;

    const time = Cesium.JulianDate.toDate(clock.currentTime);
    const gmst = satellite.gstime(time);

    let H = [];
    let inViewCount = 0;
    
    satellites.forEach(sat => {
        if (!sat.entity || constellationVisibility[sat.constellation] === false) {
            if (losEntities[sat.name]) {
                losEntities[sat.name].show = false;
                losEntities[sat.name].inViewFlag = false;
            }
            if (sat.entity && sat.entity.point) sat.entity.point.pixelSize = 8;
            return;
        }

        const positionAndVelocity = satellite.propagate(sat.satrec, time);
        let inView = false;
        let cartesianPos = null;

        if (positionAndVelocity.position && !isNaN(positionAndVelocity.position.x)) {
            const positionEci = positionAndVelocity.position;
            const positionEcf = satellite.eciToEcf(positionEci, gmst);
            const lookAngles = satellite.ecfToLookAngles(receiverGd, positionEcf);
            
            // 10 degrees elevation mask
            if (lookAngles.elevation > 10 * Math.PI / 180) {
                inView = true;
                
                const az = lookAngles.azimuth;
                const el = lookAngles.elevation;
                const e = Math.cos(el) * Math.sin(az);
                const n = Math.cos(el) * Math.cos(az);
                const u = Math.sin(el);
                
                H.push([-e, -n, -u, 1]);
            }
            
            const positionGd = satellite.eciToGeodetic(positionEci, gmst);
            cartesianPos = Cesium.Cartesian3.fromRadians(positionGd.longitude, positionGd.latitude, positionGd.height * 1000);
        }

        if (inView) {
            inViewCount++;
            sat.entity.point.pixelSize = 16; 
            
            if (!losEntities[sat.name]) {
                losEntities[sat.name] = viewer.entities.add({
                    polyline: {
                        positions: new Cesium.CallbackProperty(() => {
                            if (!receiverCartesian || !sat.lastPos) {
                                const safePos = receiverCartesian || Cesium.Cartesian3.ZERO;
                                return [safePos, safePos];
                            }
                            return [receiverCartesian, sat.lastPos];
                        }, false),
                        width: 2,
                        arcType: Cesium.ArcType.NONE,
                        material: new Cesium.PolylineDashMaterialProperty({
                            color: Cesium.Color.YELLOW.withAlpha(0.6),
                            dashLength: 16.0
                        })
                    }
                });
            }
            sat.lastPos = cartesianPos;
            losEntities[sat.name].show = showLOS;
            losEntities[sat.name].inViewFlag = true;
        } else {
            sat.entity.point.pixelSize = 8;
            if (losEntities[sat.name]) {
                losEntities[sat.name].show = false;
                losEntities[sat.name].inViewFlag = false;
            }
        }
    });

    inViewCountEl.innerText = inViewCount;

    if (H.length >= 4) {
        try {
            const H_mat = math.matrix(H);
            const H_t = math.transpose(H_mat);
            const Q = math.inv(math.multiply(H_t, H_mat));
            
            const q_ee = Q.get([0, 0]);
            const q_nn = Q.get([1, 1]);
            const q_uu = Q.get([2, 2]);
            const q_tt = Q.get([3, 3]);

            const gdop = Math.sqrt(q_ee + q_nn + q_uu + q_tt).toFixed(2);
            const hdop = Math.sqrt(q_ee + q_nn).toFixed(2);
            const vdop = Math.sqrt(q_uu).toFixed(2);

            gdopValueEl.innerText = gdop;
            hdopValueEl.innerText = hdop;
            vdopValueEl.innerText = vdop;
            
            gdopValueEl.style.color = gdop < 3 ? '#00ff7f' : gdop < 6 ? '#ffd700' : '#ff6b6b';
        } catch (e) {
            gdopValueEl.innerText = "Error";
            hdopValueEl.innerText = "Error";
            vdopValueEl.innerText = "Error";
        }
    } else {
        gdopValueEl.innerText = "N/A";
        hdopValueEl.innerText = "N/A";
        vdopValueEl.innerText = "N/A";
        gdopValueEl.style.color = '#a0aec0';
    }
});

fetchTLEData();
