// Preset pairs of the comparison page, pure data (A and B are patches on the base configuration).
// Each preset: patches for A and B on top of the base configuration (+ optionally another scenario)
export const COMPARE_PRESETS = {
  methods: { a: { method: 'combinado' }, b: { method: 'parametrico' } },
  injunctions: { a: { injunctions: { set: 'none' } }, b: { injunctions: { set: 'n8', type: 'relative' } } },
  neighbours: { a: { injunctions: { set: 'n8', type: 'relative' } }, b: { injunctions: { set: 'n4', type: 'relative' } } },
  absRel: { a: { injunctions: { set: 'n8', type: 'relative' } }, b: { injunctions: { set: 'n8', type: 'absolute' } } },
  paramInj: { a: { method: 'parametrico', injunctions: { set: 'none' } }, b: { method: 'parametrico', injunctions: { set: 'n8', type: 'absolute' } } },
  rotations: { a: { rotation: 'euler' }, b: { rotation: 'quaternion' } },
  scale: { a: { scaleMode: 'estimate' }, b: { scaleMode: 'rigid' } },
  covariance: { a: { tsCovariance: 'full' }, b: { tsCovariance: 'diagonal' } },
  matrixConstraints: { a: { rotation: 'matrix', constrainRotation: true }, b: { rotation: 'matrix', constrainRotation: false } },
  gimbal: { a: { rotation: 'euler' }, b: { rotation: 'quaternion' }, scenario: 'landscape' },
  aligned: { a: { rotation: 'quaternion' }, b: { rotation: 'axisAngle' }, scenario: 'tableAligned' }
};

