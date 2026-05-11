const translations = {
    en: {
        ui: {
            title: "Astrometry Simulator",
            gmt_label: "Greenwich Mean Time",
            ra_label: "RA:",
            dec_label: "DEC:",
            mag_label: "Mag:",
            instruction_title: "Instructions",
            zenith_label: "Zenith Dist.",
            azimuth_label: "Horiz. Angle",
            notebook_title: "Observation Log",
            btn_record: "Record Observation",
            btn_calculate: "Calculate Position",
            btn_reset: "New Simulation",
            calculating: "Calculating..."
        },
        steps: {
            welcome: "Welcome to the Astrometry Simulator! You have been dropped at a random location on Earth. Your goal is to find your position by observing the stars.",
            find_star_1: "Look through the theodolite (click and drag) to find a bright star. When a star's information appears, align it with the crosshair and click 'Record Observation'.",
            find_star_2: "Great! Now pan around and find a second bright star in a different part of the sky to get a good intersection.",
            find_star_3: "One more! Find a third star to complete your measurements.",
            calculate: "You have recorded enough observations. Click 'Calculate Position' to determine your Latitude and Longitude.",
            result: "Simulation complete! Your estimated position is: Latitude {lat}, Longitude {lon}. The true position was {true_lat}, {true_lon}."
        }
    },
    pt: {
        ui: {
            title: "Simulador de Astrometria",
            gmt_label: "Tempo Médio de Greenwich",
            ra_label: "AR:",
            dec_label: "DEC:",
            mag_label: "Mag:",
            instruction_title: "Instruções",
            zenith_label: "Dist. Zenital",
            azimuth_label: "Ângulo Horiz.",
            notebook_title: "Caderneta",
            btn_record: "Registrar Observação",
            btn_calculate: "Calcular Posição",
            btn_reset: "Nova Simulação",
            calculating: "Calculando..."
        },
        steps: {
            welcome: "Bem-vindo ao Simulador de Astrometria! Você foi deixado em um local aleatório na Terra. Seu objetivo é encontrar sua posição observando as estrelas.",
            find_star_1: "Olhe pelo teodolito (clique e arraste) para encontrar uma estrela brilhante. Quando as informações da estrela aparecerem, alinhe-a com a cruz e clique em 'Registrar Observação'.",
            find_star_2: "Ótimo! Agora gire e encontre uma segunda estrela brilhante em uma parte diferente do céu para obter uma boa interseção.",
            find_star_3: "Só mais uma! Encontre uma terceira estrela para completar suas medições.",
            calculate: "Você registrou observações suficientes. Clique em 'Calcular Posição' para determinar sua Latitude e Longitude.",
            result: "Simulação concluída! Sua posição estimada é: Latitude {lat}, Longitude {lon}. A posição verdadeira era {true_lat}, {true_lon}."
        }
    }
};

let currentLang = 'en';

function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    
    // Update UI elements
    document.getElementById('ui-title').innerText = translations[lang].ui.title;
    document.getElementById('ui-gmt-label').innerText = translations[lang].ui.gmt_label;
    document.getElementById('ui-ra-label').innerText = translations[lang].ui.ra_label;
    document.getElementById('ui-dec-label').innerText = translations[lang].ui.dec_label;
    document.getElementById('ui-mag-label').innerText = translations[lang].ui.mag_label;
    document.getElementById('ui-instruction-title').innerText = translations[lang].ui.instruction_title;
    document.getElementById('ui-zenith-label').innerText = translations[lang].ui.zenith_label;
    document.getElementById('ui-azimuth-label').innerText = translations[lang].ui.azimuth_label;
    document.getElementById('ui-notebook-title').innerText = translations[lang].ui.notebook_title;
    
    // The button might have different text depending on state, handle it in app.js, 
    // but default to record if it's currently showing record.
    const btn = document.getElementById('action-btn');
    if (btn.innerText === translations['en'].ui.btn_record || btn.innerText === translations['pt'].ui.btn_record) {
        btn.innerText = translations[lang].ui.btn_record;
    }

    // Toggle active class on language buttons
    document.getElementById('lang-en').classList.toggle('bg-white/10', lang === 'en');
    document.getElementById('lang-pt').classList.toggle('bg-white/10', lang === 'pt');

    // Trigger an event so other scripts know language changed
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
}

function t(key, params = {}) {
    const keys = key.split('.');
    let result = translations[currentLang];
    for (let k of keys) {
        result = result[k];
        if (result === undefined) return key;
    }
    
    if (typeof result === 'string') {
        for (let param in params) {
            result = result.replace(`{${param}}`, params[param]);
        }
    }
    return result;
}

// Global initialization logic for i18n
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('lang-en').addEventListener('click', () => setLanguage('en'));
    document.getElementById('lang-pt').addEventListener('click', () => setLanguage('pt'));
    setLanguage('en');
});
