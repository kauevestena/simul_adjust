# Quality Report for Adjusted Gravimetric Data

Based on the thesis "ESTRATÉGIAS APLICADAS NO AJUSTAMENTO DA REDE GRAVIMÉTRICA E ANÁLISE DE PRECISÃO E CONFIABILIDADE DAS SOLUÇÕES OBTIDAS", the quality of the selected adjusted data (the `AJUSTAMENTOINTEGRADO` solution) is summarized below.

## Chosen Solution: AJUSTAMENTOINTEGRADO

The best solution identified is `AJUSTAMENTOINTEGRADO`, which incorporates both LaCoste & Romberg and Scintrex observations, using a probabilistic neural network to classify the Scintrex data prior to integration.

### Precision and Reliability

- **Overall Precision:** The `AJUSTAMENTOINTEGRADO` solution has a high overall precision. The average precision for the estimated gravity parameters across the network is approximately **15 µGal**, which is slightly better than the 16 µGal precision achieved by the non-integrated `AJUSTAMENTOTOTAL6` solution.
- **Reliability:** External reliability measures (influence of non-localized errors on the adjusted parameters) show high consistency and quality. The integration did not compromise reliability; both solutions present essentially identical external reliability characteristics.
- **Specific Station Performance:**
    - *Ponta Grossa:* Estimated gravity is highly reliable with an external reliability measure indicating a potential gross error influence of only -0.001 mGal, and precision of 0.004 mGal.
    - *Londrina:* Showed the highest instability during observations. Its precision is 0.017 mGal and external reliability is 0.028 mGal, indicating its value is less reliable than stations like Ponta Grossa.
    - *Paranavaí and Guaíra:* Also displayed minor reliability concerns unexpected from field operations.

### Key Conclusions on Methodology

- Using absolute stations to determine a scale factor for the relative gravimeters dynamically is preferred over rigidly fixing the network to them, as it distributes the influence more homogeneously across the network.
- Adjusting a gravimetric network using independent observations (rather than average observations) allows for effective detection and localization of gross errors, substantially improving the actual reliability of the results.
- The use of neural networks to classify Scintrex observations effectively validated their compatibility with LaCoste & Romberg data without degrading the pre-established precision or reliability.

*Reference: Section 4.4 and Chapter 5, Thesis*
