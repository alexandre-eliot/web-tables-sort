// ==UserScript==
// @name         Web Tables Sort
// @version      1.0.0
// @description  A script to add buttons to `th` elements for sorting tables in a web page
// @author       Alexandre Eliot
// @grant        none
// @match https://*/*
// @match http://*/*
// ==/UserScript==

(function () {
  'use strict';

  const UTF_ARROW_UP = "&#x25B2;";
  const UTF_ARROW_DOWN = "&#x25BC;";

  const COLORS = {
    active: "grey",
    hovered: "hsl(0deg 0% 50% / 20%)",
  };

  const listenersMap = new Map();

  const globalState = new Map();

  function initializeState(key) {

    globalState.set(key, new Map());

    return globalState.get(key);
  }

  function bindListener(element, eventType, key, eventListener) {

    const listenerKey = [eventType, key].join();

    if (!listenersMap.has(listenerKey)) {

      listenersMap.delete(listenerKey);
    }

    element.addEventListener(eventType, eventListener);

    listenersMap.set(listenerKey, () => {
      element.removeEventListener(eventType, eventListener)
    });
  }

  const factorByFormat = {
    'g': 1000000000,
    'm': 1000000,
    'k': 1000
  }

  function getValueForElement(element) {

    let value = -1;

    let textElement, multiplier = 1;

    const elts = element.querySelectorAll('span,a');

    if (elts && elts.length > 0) {
      textElement = elts[0];
    } else {
      textElement = element;
    }

    if (!textElement) return value;

    const textValue = textElement.innerText.trim().replace(/\s*/g, '');

    const numericalValue = textValue.replace(/[^\d(.|,)\d]*/g, '').replace(/\,/, '.');

    const isNumeric = numericalValue.length + 1 > (textValue.length / 2)

    if (isNumeric) {

      const numeric = numericalValue;

      const lowerCaseText = textValue.toLowerCase();

      const foundFactor = Object.entries(factorByFormat).find(([key]) => {
        return lowerCaseText.indexOf(key) > -1
      })

      if (foundFactor) {
        multiplier = foundFactor[1];
      }

      value = Number.parseInt(numeric) * multiplier;

    } else {
      value = textValue.toLowerCase();
    }

    return value;
  }

  function getLastParent(parent) {
    let lastParent = parent;
    while (lastParent.childElementCount > 0 && lastParent.childElementCount < 2) {
      lastParent = lastParent.firstElementChild;
    }
    return lastParent;
  }

  function getTableBody(table) {

    let tableBody = table.getElementsByTagName('tbody')[0];

    if (!tableBody) {

      tableBody = getLastParent(table);
    }

    return tableBody
  }

  function findThInElements(elements) {
    let found = null, index = 0;
    while (!found && index < elements.length) {
      if (elements[index].tagName === 'TH') {
        found = elements[index];
      }
    }
  }

  function sortTable(table, sortDirection, indexCol) {

    const tableBody = getTableBody(table)

    const lines = tableBody.getElementsByTagName('tr');
    const linesWithoutTh = [];

    // filter out lines containing th elements
    iterateOverElements(lines, (line) => {
      const thElements = line.querySelectorAll('th');
      if (thElements.length < 1) {
        linesWithoutTh.push(line)
      }
    });

    let elementsInfos = [];

    linesWithoutTh.forEach((line) => {
      const tdSortedBy = line.getElementsByTagName('td')[indexCol];

      if (tdSortedBy) {

        const value = getValueForElement(tdSortedBy);

        elementsInfos.push({
          element: line,
          value,
        })

      }
    })

    tableBody.innerHTML = '';

    elementsInfos.sort((a, b) => {
      if (typeof b.value === 'number' && typeof a.value === 'number') {
        return (b.value - a.value) * sortDirection
      } else {
        return String(b.value).localeCompare(a.value) * sortDirection
      }
    }).forEach((info) => {
      tableBody.appendChild(info.element)
    })

  }

  function SortButton(
    key,
    {
      sortDirection,
      onClick,
    }
  ) {

    const button = document.createElement('button');

    button.classList.add('sort-button');

    const iconSpan = document.createElement('span');
    button.appendChild(iconSpan);

    if (sortDirection !== 0) {
      button.classList.add('active');
    }

    if (sortDirection > 0) {
      iconSpan.innerHTML = UTF_ARROW_UP;
    } else {
      iconSpan.innerHTML = UTF_ARROW_DOWN;
    }

    bindListener(button, 'click', key, onClick)

    return button;
  }

  function initTable(key, table) {

    let state = globalState.get(key);

    if (!state) {
      state = initializeState(key);
    }

    function stateHas(k) {
      return state.has(k);
    }

    function stateGet(k) {
      return state.get(k);
    }

    function stateSet(...keyValues) {
      keyValues.forEach(([key, value]) => {
        state.set(key, value);
      })

      update();
    }

    const elements = new Set();

    function updateSortIndex(indexCol) {

      let newSortDirection;

      if (
        stateHas('sortDirection') &&
        stateHas('sortedColumnIndex') &&
        stateGet('sortedColumnIndex') === indexCol
      ) {
        newSortDirection = stateGet('sortDirection') * -1;
      } else {
        newSortDirection = 1;
      }

      stateSet(
        ['sortedColumnIndex', indexCol],
        ['sortDirection', newSortDirection]
      );

    }

    function update() {

      elements.forEach((element) => {
        element.remove();
      })

      elements.clear();

      renderSortButtons();

      sortTable(table, stateGet('sortDirection'), stateGet('sortedColumnIndex'));
    }

    function renderSortButtons() {

      const firstContainer = table.firstElementChild;

      const lastParent = getLastParent(firstContainer);

      const colTitleElementsSet = new Set();

      const colTitleElements = [
        firstContainer.querySelectorAll(`thead th`),
        lastParent.querySelectorAll(`th`),
        lastParent.querySelectorAll(`[class*="row"] [class*="head"]`),
      ];

      colTitleElements.forEach((elements) => {
        iterateOverElements(elements, (element) => {
          colTitleElementsSet.add(element)
        })
      });

      if (colTitleElementsSet.size < 2) return -1;

      let index = -1;
      colTitleElementsSet.forEach((elt) => {
        index++;

        let sortDirection = 0;

        if (
          stateHas('sortedColumnIndex') &&
          stateGet('sortedColumnIndex') === index
        ) {
          sortDirection = stateGet('sortDirection');
        }

        const onClick = () => {
          updateSortIndex(index);
        }

        const sortButton = SortButton(
          `sort-button-${index}`,
          {
            sortDirection,
            onClick,
          }
        );

        elements.add(sortButton);

        elt.appendChild(sortButton);

      })

    }

    renderSortButtons();

  }

  function addStyle() {
    const styleElement = document.createElement('style');
    const style = `
      .sort-button {
        padding: 0.1em;
        margin-left: 0.3em;
        appearance: none;
        border: none;
        border-radius: 0.5em;
      }

      .sort-button.active {
        color: ${COLORS.active};
      }

      .sort-button:hover {
        background-color: ${COLORS.hovered};
      }

    `;
    styleElement.innerText = style;

    let headElement = document.querySelector('head');
    if (!headElement) {
      headElement = document.createElement('head');
      document.body.appendChild(headElement);
    }

    headElement.appendChild(styleElement);
  }


  function iterateOverElements(elements, iteratee) {
    for (let index = 0; index < elements.length; index++) {
      iteratee(elements[index], index, elements);
    }
  }

  function removeDuplicatesWithinSet(elementsSet) {
    // const elementsToCheck = [element];
    // while (found.childElementCount > 0 && found.childElementCount < 2) {
    //   if (elementsSet.has(found)) {
    //     elementsSet.remove(found)
    //   }
    //   found = found.firstElementChild;
    // }
    // return found;
    elementsSet.forEach((element) => {
      elementsSet.forEach((elt) => {
        if (element !== elt) {
          if (element.contains(elt)) {
            elementsSet.delete(elt);
          } else if (elt.contains(element)) {
            elementsSet.delete(element);
          }
        }
      })
    });
  }

  function findTables() {
    const tables = new Set();

    const tablesElements = [
      document.getElementsByTagName('table'),
      document.querySelectorAll(`[role^="table"]`),
      //document.querySelectorAll(`[class*="table"]:not([class*="head"]):not([class*="row"]):not([class*="col"]):not([class*="container"])`),
    ];

    tablesElements.forEach((elements) => {
      iterateOverElements(elements, (element) => {
        tables.add(element)
      })
    })

    return tables;
  }

  function init() {

    addStyle();

    const tables = findTables();

    removeDuplicatesWithinSet(tables)

    let index = 0;

    tables.forEach((table) => {
      initTable(`table-${index++}`, table);
    })

  }

  init();

})();