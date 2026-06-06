const defaultNetworkData = {
  "nodes": [
    {
      "id": "Gua\u00edra",
      "lat": -24.0851924,
      "lng": -54.2567519,
      "g": 978800.484,
      "fixed": false
    },
    {
      "id": "Jaguaria\u00edva",
      "lat": -24.2589699,
      "lng": -49.7201518,
      "g": 978652.187,
      "fixed": false
    },
    {
      "id": "Ortigueira",
      "lat": -24.2088891,
      "lng": -50.925043,
      "g": 978678.783,
      "fixed": false
    },
    {
      "id": "Maring\u00e1",
      "lat": -23.425269,
      "lng": -51.9382078,
      "g": 978666.844,
      "fixed": false
    },
    {
      "id": "Londrina",
      "lat": -23.3112878,
      "lng": -51.1595023,
      "g": 978636.848,
      "fixed": false
    },
    {
      "id": "Curitiba",
      "lat": -25.4295963,
      "lng": -49.2712724,
      "g": 978760.387,
      "fixed": true
    },
    {
      "id": "Toledo",
      "lat": -24.7222438,
      "lng": -53.7402476,
      "g": 978798.274,
      "fixed": false
    },
    {
      "id": "Joaquim T\u00e1vora",
      "lat": -23.4999724,
      "lng": -49.9232545,
      "g": 978670.149,
      "fixed": false
    },
    {
      "id": "Clevel\u00e2ndia",
      "lat": -26.404065,
      "lng": -52.3513972,
      "g": 978785.956,
      "fixed": false
    },
    {
      "id": "Guarapuava",
      "lat": -25.3950986,
      "lng": -51.4622016,
      "g": 978679.223,
      "fixed": false
    },
    {
      "id": "Laranjeiras do Sul",
      "lat": -25.4073197,
      "lng": -52.4150132,
      "g": 978704.752,
      "fixed": false
    },
    {
      "id": "Ponta Grossa",
      "lat": -25.0891685,
      "lng": -50.1601812,
      "g": 978718.59,
      "fixed": false
    },
    {
      "id": "Goio-er\u00ea",
      "lat": -24.1851885,
      "lng": -53.0250623,
      "g": 978744.597,
      "fixed": false
    },
    {
      "id": "Bituruna",
      "lat": -26.161281,
      "lng": -51.5533319,
      "g": 978779.494,
      "fixed": false
    },
    {
      "id": "S\u00e3o Mateus do Sul",
      "lat": -25.866823,
      "lng": -50.382796,
      "g": 978777.552,
      "fixed": false
    },
    {
      "id": "Iretama",
      "lat": -24.4205941,
      "lng": -52.1013532,
      "g": 978715.295,
      "fixed": false
    },
    {
      "id": "Paranava\u00ed",
      "lat": -23.08165,
      "lng": -52.461724,
      "g": 978677.87,
      "fixed": false
    },
    {
      "id": "Valinhos",
      "lat": -22.97056,
      "lng": -46.99583,
      "g": 978563.778,
      "fixed": true
    },
    {
      "id": "Francisco Beltr\u00e3o",
      "lat": -26.0790979,
      "lng": -53.0533527,
      "g": 978807.889,
      "fixed": false
    }
  ],
  "links": [
    {
      "source": "Curitiba",
      "target": "S\u00e3o Mateus do Sul",
      "dg": 17.165,
      "variance": 0.00569,
      "heuristic_weight": 8.797
    },
    {
      "source": "S\u00e3o Mateus do Sul",
      "target": "Bituruna",
      "dg": 1.942,
      "variance": 0.00113,
      "heuristic_weight": 7.701
    },
    {
      "source": "Bituruna",
      "target": "Clevel\u00e2ndia",
      "dg": 6.462,
      "variance": 0.00271,
      "heuristic_weight": 7.18
    },
    {
      "source": "Clevel\u00e2ndia",
      "target": "Francisco Beltr\u00e3o",
      "dg": 21.933,
      "variance": 0.00099,
      "heuristic_weight": 4.931
    },
    {
      "source": "Toledo",
      "target": "Francisco Beltr\u00e3o",
      "dg": 9.615,
      "variance": 0.00562,
      "heuristic_weight": 8.67
    },
    {
      "source": "Toledo",
      "target": "Gua\u00edra",
      "dg": 2.21,
      "variance": 0.00122,
      "heuristic_weight": 5.474
    },
    {
      "source": "Goio-er\u00ea",
      "target": "Toledo",
      "dg": 53.677,
      "variance": 0.00106,
      "heuristic_weight": 5.463
    },
    {
      "source": "Laranjeiras do Sul",
      "target": "Toledo",
      "dg": 93.522,
      "variance": 0.00411,
      "heuristic_weight": 7.071
    },
    {
      "source": "Guarapuava",
      "target": "Laranjeiras do Sul",
      "dg": 25.529,
      "variance": 0.00304,
      "heuristic_weight": 4.321
    },
    {
      "source": "Guarapuava",
      "target": "Bituruna",
      "dg": 100.271,
      "variance": 0.00225,
      "heuristic_weight": 5.694
    },
    {
      "source": "Guarapuava",
      "target": "Ponta Grossa",
      "dg": 39.367,
      "variance": 0.00152,
      "heuristic_weight": 6.904
    },
    {
      "source": "Ponta Grossa",
      "target": "Curitiba",
      "dg": 41.797,
      "variance": 0.00166,
      "heuristic_weight": 7.203
    },
    {
      "source": "Ortigueira",
      "target": "Ponta Grossa",
      "dg": 39.807,
      "variance": 0.00373,
      "heuristic_weight": 5.099
    },
    {
      "source": "Londrina",
      "target": "Ortigueira",
      "dg": 41.935,
      "variance": 0.00104,
      "heuristic_weight": 5.16
    },
    {
      "source": "Jaguaria\u00edva",
      "target": "Ponta Grossa",
      "dg": 66.403,
      "variance": 0.00192,
      "heuristic_weight": 4.799
    },
    {
      "source": "Jaguaria\u00edva",
      "target": "Joaquim T\u00e1vora",
      "dg": 17.962,
      "variance": 0.00203,
      "heuristic_weight": 5.137
    },
    {
      "source": "Londrina",
      "target": "Joaquim T\u00e1vora",
      "dg": 33.301,
      "variance": 0.00204,
      "heuristic_weight": 6.903
    },
    {
      "source": "Londrina",
      "target": "Maring\u00e1",
      "dg": 29.996,
      "variance": 0.00278,
      "heuristic_weight": 4.017
    },
    {
      "source": "Maring\u00e1",
      "target": "Iretama",
      "dg": 48.451,
      "variance": 0.00459,
      "heuristic_weight": 5.611
    },
    {
      "source": "Guarapuava",
      "target": "Iretama",
      "dg": 36.072,
      "variance": 0.00413,
      "heuristic_weight": 5.549
    },
    {
      "source": "Maring\u00e1",
      "target": "Paranava\u00ed",
      "dg": 11.026,
      "variance": 0.00227,
      "heuristic_weight": 3.546
    },
    {
      "source": "Paranava\u00ed",
      "target": "Goio-er\u00ea",
      "dg": 66.727,
      "variance": 0.00343,
      "heuristic_weight": 6.917
    },
    {
      "source": "Goio-er\u00ea",
      "target": "Gua\u00edra",
      "dg": 55.887,
      "variance": 0.00358,
      "heuristic_weight": 7.574
    },
    {
      "source": "Jaguaria\u00edva",
      "target": "Curitiba",
      "dg": 108.2,
      "variance": 0.00055,
      "heuristic_weight": 8.397
    },
    {
      "source": "Valinhos",
      "target": "Jaguaria\u00edva",
      "dg": 88.409,
      "variance": 0.00157,
      "heuristic_weight": 25.663
    }
  ]
};
