let appState = {
    trueLat: 0,
    trueLon: 0,
    azimuthOffset: 0, // Random offset added to true azimuth
    simTime: new Date(),
    starsData: [],
    observations: [],
    step: 'welcome', // welcome, find_star_1, find_star_2, find_star_3, calculate, result
    currentHoveredStar: null,
    viewport: null
};

// UI Elements
const ui = {
    clock: document.getElementById('clock-display'),
    zenith: document.getElementById('reading-zenith'),
    azimuth: document.getElementById('reading-azimuth'),
    instructionText: document.getElementById('instruction-text'),
    actionBtn: document.getElementById('action-btn'),
    obsList: document.getElementById('observation-list'),
    starTooltip: document.getElementById('star-tooltip'),
    starName: document.getElementById('star-name'),
    starRa: document.getElementById('star-ra'),
    starDec: document.getElementById('star-dec'),
    starMag: document.getElementById('star-mag')
};

async function initApp() {
    // 1. Generate random location and offset
    // Latitude: -60 to +60, Longitude: -180 to 180
    appState.trueLat = (Math.random() * 120) - 60;
    appState.trueLon = (Math.random() * 360) - 180;
    appState.azimuthOffset = Math.random() * 360; 

    // Set a random time in the night (let's just use current UTC but random hour)
    const now = new Date();
    appState.simTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0));

    // 2. Load stars data
    appState.starsData = GLOBAL_STARS_DATA;

    // 3. Init Viewport
    appState.viewport = new Viewport3D('canvas-container');
    appState.viewport.populateStars(appState.starsData, appState.trueLat, appState.trueLon, appState.simTime);

    // 4. Start Clock
    updateClockDisplay();
    setInterval(tickClock, 1000);

    // 5. Setup Events
    document.addEventListener('viewportMoved', (e) => {
        updateReadings(e.detail.pitch, e.detail.yaw);
    });

    // Raycaster interval (check 10 times a second)
    setInterval(checkStarHover, 100);

    // Action button
    ui.actionBtn.addEventListener('click', handleAction);

    // FPS controls: trigger action on left click if pointer is locked
    document.getElementById('canvas-container').addEventListener('click', () => {
        if (document.pointerLockElement && !ui.actionBtn.disabled) {
            handleAction();
        }
    });

    // Also allow Spacebar or Enter to trigger action
    window.addEventListener('keydown', (e) => {
        if ((e.code === 'Space' || e.code === 'Enter') && !ui.actionBtn.disabled) {
            handleAction();
        }
    });

    // Listen to lang change to update instructions
    document.addEventListener('languageChanged', updateInstructions);

    // Initial state
    setStep('find_star_1');
}

function updateClockDisplay() {
    const h = appState.simTime.getUTCHours().toString().padStart(2, '0');
    const m = appState.simTime.getUTCMinutes().toString().padStart(2, '0');
    const s = appState.simTime.getUTCSeconds().toString().padStart(2, '0');
    ui.clock.innerText = `${h}:${m}:${s}`;
}

function tickClock() {
    // Advance simulation time by 1 second
    appState.simTime.setSeconds(appState.simTime.getSeconds() + 1);
    
    // Update UI
    updateClockDisplay();
    
    // Ideally we should update star positions over time, but for a short simulation they move very little.
    // If the user waits an hour, the stars will be wrong. Let's update the stars every minute.
    if (appState.simTime.getSeconds() === 0) {
        appState.viewport.populateStars(appState.starsData, appState.trueLat, appState.trueLon, appState.simTime);
    }
}

function updateReadings(pitch, yaw) {
    const zenithDist = 90 - pitch;
    // The theodolite shows a relative azimuth
    const relAz = AstronomyMath.normalizeAngle(yaw - appState.azimuthOffset);

    ui.zenith.innerText = AstronomyMath.formatAngle(zenithDist);
    ui.azimuth.innerText = AstronomyMath.formatAngle(relAz);
}

function checkStarHover() {
    if (!appState.viewport) return;
    
    const star = appState.viewport.checkCrosshairIntersect();
    if (star) {
        if (appState.currentHoveredStar !== star) {
            appState.currentHoveredStar = star;
            showStarTooltip(star);
            ui.actionBtn.disabled = false;
        }
    } else {
        if (appState.currentHoveredStar !== null) {
            appState.currentHoveredStar = null;
            hideStarTooltip();
            // If in observation steps, disable button when no star is focused
            if (appState.step.startsWith('find_star')) {
                ui.actionBtn.disabled = true;
            }
        }
    }
}

function showStarTooltip(star) {
    ui.starName.innerText = star.name;
    ui.starRa.innerText = AstronomyMath.formatAngle(star.ra, true);
    ui.starDec.innerText = AstronomyMath.formatAngle(star.dec);
    ui.starMag.innerText = star.mag.toFixed(2);
    
    ui.starTooltip.classList.remove('opacity-0');
    ui.starTooltip.classList.add('opacity-100');
}

function hideStarTooltip() {
    ui.starTooltip.classList.remove('opacity-100');
    ui.starTooltip.classList.add('opacity-0');
}

function setStep(step) {
    appState.step = step;
    updateInstructions();

    if (step.startsWith('find_star')) {
        ui.actionBtn.innerText = t('ui.btn_record');
        ui.actionBtn.disabled = appState.currentHoveredStar === null;
    } else if (step === 'calculate') {
        ui.actionBtn.innerText = t('ui.btn_calculate');
        ui.actionBtn.disabled = false;
    } else if (step === 'result') {
        ui.actionBtn.innerText = t('ui.btn_reset');
        ui.actionBtn.disabled = false;
    }
}

function updateInstructions() {
    let msg = "";
    if (appState.step === 'result') {
        // We need to inject variables
        // Result step will have its msg set during calculate
        return; 
    } else {
        msg = t('steps.' + appState.step);
    }
    ui.instructionText.innerText = msg;
}

function handleAction() {
    if (appState.step.startsWith('find_star')) {
        recordObservation();
    } else if (appState.step === 'calculate') {
        performCalculation();
    } else if (appState.step === 'result') {
        location.reload(); // Simple reset
    }
}

function recordObservation() {
    if (!appState.currentHoveredStar) return;

    const pitch = appState.viewport.pitch;
    const yaw = appState.viewport.yaw;
    const zenithDist = 90 - pitch;
    const relAz = AstronomyMath.normalizeAngle(yaw - appState.azimuthOffset);
    
    const obs = {
        name: appState.currentHoveredStar.name,
        ra: appState.currentHoveredStar.ra,
        dec: appState.currentHoveredStar.dec,
        observedZenith: zenithDist,
        observedRelativeAz: relAz,
        time: new Date(appState.simTime)
    };
    
    appState.observations.push(obs);

    // Add to UI
    const div = document.createElement('div');
    div.className = "obs-entry";
    
    const h = obs.time.getUTCHours().toString().padStart(2, '0');
    const m = obs.time.getUTCMinutes().toString().padStart(2, '0');
    const s = obs.time.getUTCSeconds().toString().padStart(2, '0');

    div.innerHTML = `
        <div class="font-bold text-blue-300">${obs.name}</div>
        <div class="flex justify-between text-slate-400">
            <span>T: ${h}:${m}:${s}</span>
        </div>
        <div class="flex justify-between text-cyan-200">
            <span>Z: ${AstronomyMath.formatAngle(obs.observedZenith)}</span>
        </div>
        <div class="flex justify-between text-cyan-200">
            <span>Hz: ${AstronomyMath.formatAngle(obs.observedRelativeAz)}</span>
        </div>
    `;
    ui.obsList.appendChild(div);
    ui.obsList.scrollTop = ui.obsList.scrollHeight;

    // Progress step
    if (appState.observations.length === 1) setStep('find_star_2');
    else if (appState.observations.length === 2) setStep('find_star_3');
    else if (appState.observations.length >= 3) setStep('calculate');
}

function performCalculation() {
    ui.actionBtn.innerText = t('ui.calculating');
    ui.actionBtn.disabled = true;

    // Simulate delay
    setTimeout(() => {
        const result = AstronomyMath.calculatePosition(appState.observations);
        
        const latStr = AstronomyMath.formatAngle(result.lat);
        const lonStr = AstronomyMath.formatAngle(result.lon);
        const trueLatStr = AstronomyMath.formatAngle(appState.trueLat);
        const trueLonStr = AstronomyMath.formatAngle(appState.trueLon);

        const msg = t('steps.result', {
            lat: latStr,
            lon: lonStr,
            true_lat: trueLatStr,
            true_lon: trueLonStr
        });

        appState.step = 'result';
        ui.instructionText.innerHTML = msg + `<br><br><span class="text-amber-400">Azimuth Constant: ${AstronomyMath.formatAngle(result.azimuthConstant)}</span>`;
        ui.actionBtn.innerText = t('ui.btn_reset');
        ui.actionBtn.disabled = false;

    }, 1000);
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    // Slight delay to ensure translations are loaded if they run synchronously
    setTimeout(initApp, 100);
});
