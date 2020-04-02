'use strict';

const BASE_API_URL = 'https://corona.lmao.ninja';
let objInfoWindows = {};
let markers = {};

async function initMap() {
    const props = {
        center: {
            lat: 15,
            lng: 0
        },
        zoom: 2
    };
    const map = new google.maps.Map(document.getElementById('map'), props);
    let globalData = null;
    let countriesData = null;
    let countryNamesES = null;

    await showModal('#modalLoading');
    try {
        const globalRes = await fetch(`${BASE_API_URL}/all`);
        globalData = await globalRes.json();
        cacheAPIData('globalData', globalData);

        const countriesRes = await fetch(`${BASE_API_URL}/countries?sort=cases`);
        countriesData = await countriesRes.json();
        cacheAPIData('countryData', countriesData);

        const countryNamesESRes = await fetch('https://raw.githubusercontent.com/umpirsky/country-list/master/data/es_MX/country.json');
        countryNamesES = await countryNamesESRes.json();
    }
    catch (error) {
        globalData = retrieveCachedAPIData('globalData');
        countriesData = retrieveCachedAPIData('countryData');
        await hideModal('#modalLoading');
        if (!globalData || !countriesData) {
            await showModal('#modalError');
        }
    }

    updateInfoCards(globalData, countriesData, countryNamesES);
    addCountryMarkers(countriesData, countryNamesES, map);

    await hideModal('#modalLoading');
}

function generateCountryInfoHTML(country, countryES) {
    return `
        <div class="googleMapMarker">
            <div style="display:flex; flex-direction: column; align-items: center; padding-bottom: 1em;">
                <img src="${country.countryInfo.flag}" alt="Bandera de ${countryES[country.countryInfo.iso2] || country.country}" style="width: 60%;">
            </div>
            <div style="display:flex; flex-direction: column; align-items: center;">
                <div>
                    <b>Casos: </b>${country.cases.toLocaleString('en')}<br>
                </div>
                <div>
                    <b>Muertes: </b>${country.deaths.toLocaleString('en')}<br>
                </div>
                <div>
                    <b>Recuperados: </b>${country.recovered.toLocaleString('en')}<br>
                </div>
            </div>
        </div>
    `;
}

function generateFullCountryInfoHTML(country, countryES) {
    return `
        <div class="googleMapRightControl">
            <div style="display:flex; flex-direction: column; align-items: center; padding-bottom: 1em;">
                <img src="${country.countryInfo.flag}" alt="Bandera de ${countryES[country.countryInfo.iso2] || country.country}" style="width: 60%;">
                <h5 style="margin: 3px 0 0 0;">${countryES[country.countryInfo.iso2] || country.country}</h5>
            </div>
            <div style="display:flex; justify-content: center;">
                <table>
                    <tr>
                        <td><b>Casos</b></td>
                        <td>${country.cases.toLocaleString('en')}</td>
                    </tr>
                    <tr>
                        <td><b>Nuevos hoy</b></td>
                        <td>${country.todayCases.toLocaleString('en')}</td>
                    </tr>
                    <tr>
                        <td><b>Muertes</b></td>
                        <td>${country.deaths.toLocaleString('en')}</td>
                    </tr>
                    <tr>
                        <td><b>Muertes hoy</b></td>
                        <td>${country.todayDeaths.toLocaleString('en')}</td>
                    </tr>
                    <tr>
                        <td><b>Recuperados</b></td>
                        <td>${country.recovered.toLocaleString('en')}</td>
                    </tr>
                    <tr>
                        <td><b>Activos</b></td>
                        <td>${country.active.toLocaleString('en')}</td>
                    </tr>
                    <tr>
                        <td><b>Críticos</b></td>
                        <td>${country.critical.toLocaleString('en')}</td>
                    </tr>
                    <tr>
                        <td><b>Casos/millón</b></td>
                        <td>${country.casesPerOneMillion.toLocaleString('en')}</td>
                    </tr>
                </table>
            </div>
        </div>
    `;
}

function makeControl(controlDiv, country, countryES) {
    // Set up the control border.
    const controlUI = document.createElement('div');
    controlUI.title = countryES[country.countryInfo.iso2] || country.country;
    controlUI.className = 'controlUI';
    controlDiv.appendChild(controlUI);

    // Set up the inner control.
    const controlText = document.createElement('div');
    controlText.innerHTML = generateFullCountryInfoHTML(country, countryES);
    controlText.className = 'controlText';
    controlUI.appendChild(controlText);
}

function updateInfoCards(globalData, countriesData, countryNamesES) {
    const tblCountryCases = document.getElementById('countryCasesTable');
    const divLastUpdated = document.getElementById('lastUpdated');
    const divGlobalConfirmedCases = document.getElementById('globalConfirmedCases');
    const divGlobalActiveCases = document.getElementById('globalActiveCases');
    const divGlobalRecovered = document.getElementById('globalRecovered');
    const divGlobalDeaths = document.getElementById('globalDeaths');

    countriesData.forEach((country, i) => {
        const tdPosicion = document.createElement('td');
        const tdPais = document.createElement('td');
        const tdCasos = document.createElement('td');

        tdPosicion.textContent = i + 1;
        tdPais.textContent = countryNamesES[country.countryInfo.iso2] || country.country;

        const spanCasos = document.createElement('span');
        spanCasos.textContent = country.cases.toLocaleString('en');
        spanCasos.className = 'badge badge-pill badge-warning';

        tdCasos.appendChild(spanCasos);

        const tr = document.createElement('tr');
        tr.id = country.country;
        tr.appendChild(tdPosicion);
        tr.appendChild(tdPais);
        tr.appendChild(tdCasos);

        tr.addEventListener('click', evt => {
            const country = evt.currentTarget.id;
            closeAllInfoWindows();
            google.maps.event.trigger(markers[country], 'click');
        });

        tblCountryCases.appendChild(tr);
    });

    divLastUpdated.textContent = new Date(globalData.updated).toLocaleString('es-us', { hour12: true });
    divGlobalConfirmedCases.textContent = globalData.cases.toLocaleString('en');
    divGlobalActiveCases.textContent = globalData.active.toLocaleString('en');
    divGlobalRecovered.textContent = globalData.recovered.toLocaleString('en');
    divGlobalDeaths.textContent = globalData.deaths.toLocaleString('en');
}

function addCountryMarkers(countriesData, countryNamesES, map) {
    const icon = {
        url: 'https://image.flaticon.com/icons/png/128/2659/2659980.png',
        scaledSize: new google.maps.Size(24, 24),
        origin: new google.maps.Point(0, 0)
    };

    for (const country of countriesData) {
        const info = generateCountryInfoHTML(country, countryNamesES);
        const infoWindow = new google.maps.InfoWindow({
            content: info
        });

        const marker = new google.maps.Marker({
            map: map,
            icon: icon,
            position: new google.maps.LatLng(country.countryInfo.lat, country.countryInfo.long),
            title: `${countryNamesES[country.countryInfo.iso2] || country.country}`
        });

        markers[country.country] = marker;
        marker.addListener('click', () => {
            closeAllInfoWindows();
            infoWindow.open(map, marker);
            const divName = document.createElement('div');
            new makeControl(divName, country, countryNamesES);

            let fullInfoWindow = setInterval(() => {
                if (!infoWindow.getMap()) {
                    clearInterval(fullInfoWindow);
                    map.controls[google.maps.ControlPosition.RIGHT_CENTER].pop();
                }
                else if (map.controls[google.maps.ControlPosition.RIGHT_CENTER].length === 0) {
                    map.controls[google.maps.ControlPosition.RIGHT_CENTER].push(divName);
                }
            }, 100);
        });

        objInfoWindows[country.country] = infoWindow;
    }
}

function cacheAPIData(key, jsonData) {
    localStorage.setItem(key, JSON.stringify(jsonData));
}

function retrieveCachedAPIData(key) {
    return JSON.parse(localStorage.getItem(key));
}

function closeAllInfoWindows() {
    for (const infoWinKey in objInfoWindows) {
        objInfoWindows[infoWinKey].close();
    }
}

async function showModal(modalId) {
    $(modalId).modal({ backdrop: 'static', keyboard: true, show: true });
    return new Promise((resolve, reject) => {
        $(modalId).on('shown.bs.modal', evt => {
            resolve();
        });
    });
}

async function hideModal(modalId) {
    $(modalId).modal('hide');
    return new Promise((resolve, reject) => {
        $(modalId).on('hidden.bs.modal', evt => {
            resolve();
        });
    });
}
