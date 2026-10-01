const words = {
  title: ["Formação de imagens", "Image formation"],
  subtitle: ["Laboratório de Fotogrametria", "Photogrammetry laboratory"],
  portal: ["Todos os simuladores", "All simulators"],
  image: ["Imagem formada", "Formed image"],
  physical: ["Plano físico", "Physical plane"],
  virtual: ["Plano virtual", "Virtual plane"],
  physicalHint: [
    "Atrás do centro de projeção · imagem invertida",
    "Behind the projection center · inverted image",
  ],
  virtualHint: [
    "À frente do centro de projeção · convenção OpenCV",
    "In front of the projection center · OpenCV convention",
  ],
  sensor: ["Imagem e sensor", "Image & sensor"],
  plane: ["Plano da imagem", "Image plane"],
  sampling: ["Amostragem", "Sampling"],
  continuous: ["Contínua", "Continuous"],
  pixels: ["Pixelada", "Pixelated"],
  sampleHint: [
    "A projeção é contínua. Os pixels amostram a imagem; a distorção é um efeito independente.",
    "Projection is continuous. Pixels sample the image; distortion is an independent effect.",
  ],
  resolution: ["Resolução horizontal (px)", "Horizontal resolution (px)"],
  width: ["Largura (mm)", "Width (mm)"],
  height: ["Altura (mm)", "Height (mm)"],
  focal: ["Distância focal (mm)", "Focal length (mm)"],
  offset: [
    "Deslocamento do ponto principal (mm)",
    "Principal-point offset (mm)",
  ],
  offsetHint: [
    "No plano virtual: +x à direita, +y para baixo, a partir do centro do sensor.",
    "On the virtual plane: +x right, +y down, measured from the sensor center.",
  ],
  camera: ["Câmera", "Camera"],
  position: ["Centro da câmera C · mundo (m)", "Camera center C · world (m)"],
  representation: ["Editar orientação como", "Edit orientation as"],
  angles: ["Ângulos ω, φ, κ", "Angles ω, φ, κ"],
  quaternion: ["Quaternion qcw", "Quaternion qcw"],
  matrix: ["Matriz Rwc", "Matrix Rwc"],
  applyRotation: ["Aplicar orientação", "Apply orientation"],
  faceObject: [
    "Fazer a câmera apontar para o objeto",
    "Make the camera face the object",
  ],
  rotationHint: [
    "ω, φ, κ em graus. qcw = [w, x, y, z] orienta a câmera no mundo. Rwc transforma mundo → câmera.",
    "ω, φ, κ in degrees. qcw = [w, x, y, z] orients the camera in the world. Rwc transforms world → camera.",
  ],
  distortion: ["Distorção da lente", "Lens distortion"],
  model: ["Modelo", "Model"],
  none: ["Sem distorção", "No distortion"],
  distortionHint: [
    "Coeficientes adimensionais aplicados às coordenadas normalizadas.",
    "Dimensionless coefficients applied to normalized coordinates.",
  ],
  object: ["Objeto", "Object"],
  objectPosition: ["Centro do cubo · mundo (m)", "Cube center · world (m)"],
  side: ["Aresta do cubo (m)", "Cube side (m)"],
  objectAngles: [
    "Orientação do cubo · X, Y, Z (°)",
    "Cube orientation · X, Y, Z (°)",
  ],
  guides: ["Guias de visualização", "View guides"],
  axes: ["Eixos de coordenadas", "Coordinate axes"],
  frustum: ["Campo de visão ideal", "Ideal field of view"],
  pixelGrid: [
    "Grade de pixels (baixa resolução)",
    "Pixel grid (low resolution)",
  ],
  reset: ["Restaurar simulação", "Reset simulation"],
  theory: ["Entenda a projeção", "Understand the projection"],
  reference: ["Referência: OpenCV 4.13", "Reference: OpenCV 4.13"],
  world: ["Mundo 3D", "3D world"],
  navigate: [
    "Arraste para orbitar · roda para zoom · botão direito para deslocar",
    "Drag to orbit · wheel to zoom · right-drag to pan",
  ],
  resetView: ["Enquadrar cena", "Fit scene"],
  vertex: ["Selecionar vértice…", "Select a vertex…"],
  orientation: ["Orientação da câmera", "Camera orientation"],
  worldCamera: ["Mundo → câmera", "World → camera"],
  cameraWorld: ["Câmera → mundo", "Camera → world"],
  detail: [
    "Câmera em detalhe · dimensões reais",
    "Camera detail · true dimensions",
  ],
  ray: ["Raio ideal", "Ideal ray"],
  distorted: ["Projeção distorcida", "Distorted projection"],
  point: ["Ponto em inspeção", "Inspected point"],
  hoverHint: [
    "Passe o cursor sobre o cubo ou selecione um vértice. Clique para fixar o ponto.",
    "Hover over the cube or choose a vertex. Click to pin the point.",
  ],
  pinned: ["Ponto fixado", "Pinned point"],
  hover: ["Prévia", "Hover preview"],
  clear: ["Limpar ponto", "Clear point"],
  visible: ["Visível no sensor", "Visible on sensor"],
  occluded: ["Oculto por outra face", "Occluded by another face"],
  outside: ["Fora do sensor", "Outside the sensor"],
  behind: ["Atrás da câmera / profundidade nula", "Behind camera / zero depth"],
  worldCoords: ["Mundo · m", "World · m"],
  cameraCoords: ["Câmera · m", "Camera · m"],
  normalized: ["Normalizadas (x, y)", "Normalized (x, y)"],
  imageMM: [
    "Plano · mm, a partir do eixo óptico",
    "Plane · mm, from optical axis",
  ],
  imageUV: ["Imagem exibida (u, v)", "Displayed image (u, v)"],
  cvUV: ["OpenCV (u, v)", "OpenCV (u, v)"],
  pixel: ["Pixel [coluna, linha]", "Pixel [column, row]"],
  selectionNote: [
    "Marcadores são guias: um ponto oculto não aparece na imagem.",
    "Markers are guides: an occluded point does not appear in the image.",
  ],
  invalidNumber: [
    "Digite um número finito válido (ponto ou vírgula decimal).",
    "Enter a valid finite number (decimal dot or comma).",
  ],
  invalidRotation: [
    "Rotação inválida. Use quaternion não nulo ou matriz ortonormal com determinante +1.",
    "Invalid rotation. Use a nonzero quaternion or an orthonormal matrix with determinant +1.",
  ],
  range: [
    "Valor fora do intervalo indicado.",
    "Value is outside the indicated range.",
  ],
  zeroVector: [
    "A câmera e o centro do cubo coincidem; não há direção única.",
    "Camera and cube center coincide; there is no unique viewing direction.",
  ],
  tooLarge: [
    "A resolução resultante deve ter até 4096 pixels por dimensão e 8 milhões de pixels.",
    "Resulting resolution must be at most 4096 pixels per dimension and 8 million pixels.",
  ],
  singular: [
    "Singularidade de Euler: representação equivalente com κ = 0°. A orientação permanece válida.",
    "Euler singularity: equivalent representation with κ = 0°. The orientation remains valid.",
  ],
  fold: [
    "Este modelo dobra ou não inverte parte do campo. Reduza os coeficientes; regiões sem inversa ficam vazias.",
    "This model folds or cannot invert part of the field. Reduce the coefficients; regions without an inverse remain empty.",
  ],
  webgl: [
    "Este simulador requer WebGL. Ative a aceleração gráfica ou use outro navegador.",
    "This simulator requires WebGL. Enable graphics acceleration or use another browser.",
  ],
  fov: ["Campo ideal H × V", "Ideal field H × V"],
  pitch: ["Passo do pixel", "Pixel pitch"],
  close: ["Fechar", "Close"],
  theoryTitle: ["Do ponto 3D à imagem", "From the 3D point to the image"],
  theory1: ["1. Referenciais", "1. Coordinate frames"],
  theory1Text: [
    "X aponta à direita, Y para baixo e Z para a frente da câmera. C é a posição da câmera no mundo. A matriz Rwc leva vetores do mundo à câmera; t não é a posição da câmera.",
    "X points right, Y down and Z forward in the camera frame. C is the camera position in the world. Rwc maps world vectors to the camera; t is not the camera position.",
  ],
  theory2: ["2. Projeção e distorção", "2. Projection and distortion"],
  theory2Text: [
    "Divida Xc e Yc pela profundidade Zc positiva. O modelo de OpenCV aplica a distorção radial e tangencial às coordenadas normalizadas. O raio amarelo termina na interseção ideal; o deslocamento verde mostra o efeito da distorção no plano, sem representar um trajeto óptico pela lente.",
    "Divide Xc and Yc by positive depth Zc. The OpenCV model applies radial and tangential distortion to normalized coordinates. The yellow ray ends at the ideal intersection; the green displacement shows distortion on the plane, without representing an optical path through a lens.",
  ],
  theory3: [
    "3. Dois planos, a mesma projeção",
    "3. Two planes, the same projection",
  ],
  theory3Text: [
    "O plano virtual está em Zc = +f. O plano físico está em Zc = −f e inverte as duas coordenadas. A imagem física é mostrada com os mesmos sentidos de X e Y do plano virtual, tornando a inversão visível. As coordenadas OpenCV continuam disponíveis.",
    "The virtual plane is at Zc = +f. The physical plane is at Zc = −f and reverses both coordinates. The physical image is displayed with the same X and Y directions as the virtual plane, making inversion visible. OpenCV coordinates remain available.",
  ],
  theory4: ["4. Do milímetro ao pixel", "4. From millimeters to pixels"],
  theory4Text: [
    "Centros de pixels têm índices inteiros, começando em (0, 0); as bordas do sensor ficam em −0,5 e N−0,5. O ponto principal sem deslocamento é ((W−1)/2, (H−1)/2). A altura da imagem é arredondada para o inteiro mais próximo da proporção do sensor. A imagem pixelada amostra o centro de cada pixel. O modo contínuo é uma aproximação de alta resolução na tela.",
    "Pixel centers have integer indices starting at (0, 0); sensor edges are at −0.5 and N−0.5. With zero offset the principal point is ((W−1)/2, (H−1)/2). Image height is rounded to the nearest integer for the sensor aspect ratio. Pixelated mode samples each pixel center. Continuous mode is a high-resolution screen approximation.",
  ],
  theory5: ["Convenção fotogramétrica", "Photogrammetric convention"],
  theory5Text: [
    "Usamos rotações passivas: Rwc = Rκ Rφ Rω. O quaternion representa a orientação inversa, câmera → mundo. Em termos de rotações ativas: Qcw = Rx(ω) Ry(φ) Rz(κ). Matrizes abaixo definem todos os sinais; a ordem importa.",
    "We use passive rotations: Rwc = Rκ Rφ Rω. The quaternion represents the inverse orientation, camera → world. In active-rotation terms: Qcw = Rx(ω) Ry(φ) Rz(κ). The matrices below define every sign; order matters.",
  ],
  dimensions: ["Resolução", "Resolution"],
  principalLegend: ["Ponto principal", "Principal point"],
  rotationApplied: [
    "Orientação aplicada. Quaternion normalizado.",
    "Orientation applied. Quaternion normalized.",
  ],
};
let language = "pt-BR";
export const t = (key) => words[key]?.[language === "pt-BR" ? 0 : 1] ?? key;
export const getLanguage = () => language;
export function setLanguage(lang) {
  language = lang === "en" ? "en" : "pt-BR";
  document.documentElement.lang = language;
  document.title = `camera_proj · ${t("title")}`;
  document
    .querySelectorAll("[data-t]")
    .forEach((el) => (el.textContent = t(el.dataset.t)));
  document
    .querySelectorAll("[data-label]")
    .forEach((el) => el.setAttribute("aria-label", t(el.dataset.label)));
  document
    .querySelectorAll("[data-lang]")
    .forEach((el) =>
      el.setAttribute("aria-pressed", String(el.dataset.lang === language)),
    );
}
