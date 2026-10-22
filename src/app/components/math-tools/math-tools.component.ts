import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type MathMode = 'eval' | 'matrix' | 'stats' | 'percentage' | 'geometry' | 'primes' | 'fractions';

@Component({
  selector: 'app-math-tools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './math-tools.component.html',
  styleUrl: './math-tools.component.scss'
})
export class MathToolsComponent {
  mode = signal<MathMode>('matrix');

  // ==========================================
  // 1. Matrix Manipulations
  // ==========================================
  matrixOp = signal<'add' | 'subtract' | 'multiply' | 'determinant' | 'transpose' | 'invert' | 'scalar'>('multiply');
  
  // Matrix A dimensions (Rows x Cols)
  rowsA = signal<number>(2);
  colsA = signal<number>(2);

  // Matrix B dimensions (Rows x Cols)
  rowsB = signal<number>(2);
  colsB = signal<number>(2);

  matrixScalarVal = signal<number>(2);

  matrixA = signal<number[][]>([
    [1, 2],
    [3, 4]
  ]);

  matrixB = signal<number[][]>([
    [2, 0],
    [1, 2]
  ]);

  updateCellA(r: number, c: number, val: number) {
    this.matrixA.update(mat => mat.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? val : cell))));
  }

  updateCellB(r: number, c: number, val: number) {
    this.matrixB.update(mat => mat.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? val : cell))));
  }

  applySizeA(r: number, c: number) {
    r = Math.max(1, Math.min(10, Math.floor(r) || 1));
    c = Math.max(1, Math.min(10, Math.floor(c) || 1));
    this.rowsA.set(r);
    this.colsA.set(c);

    this.matrixA.update(old => {
      const newMat: number[][] = [];
      for (let i = 0; i < r; i++) {
        newMat[i] = [];
        for (let j = 0; j < c; j++) {
          newMat[i][j] = old[i]?.[j] ?? (i === j ? 1 : 0);
        }
      }
      return newMat;
    });

    // Auto sync B dimensions for sensible operations
    const op = this.matrixOp();
    if (op === 'multiply') {
      if (this.rowsB() !== c) {
        this.applySizeB(c, this.colsB());
      }
    } else if (op === 'add' || op === 'subtract') {
      this.applySizeB(r, c);
    }
  }

  applySizeB(r: number, c: number) {
    r = Math.max(1, Math.min(10, Math.floor(r) || 1));
    c = Math.max(1, Math.min(10, Math.floor(c) || 1));
    this.rowsB.set(r);
    this.colsB.set(c);

    this.matrixB.update(old => {
      const newMat: number[][] = [];
      for (let i = 0; i < r; i++) {
        newMat[i] = [];
        for (let j = 0; j < c; j++) {
          newMat[i][j] = old[i]?.[j] ?? (i === j ? 1 : 0);
        }
      }
      return newMat;
    });
  }

  setPresetSize(size: number) {
    this.applySizeA(size, size);
    this.applySizeB(size, size);
  }

  fillRandom(target: 'A' | 'B') {
    const update = (rows: number, cols: number) => {
      const mat: number[][] = [];
      for (let i = 0; i < rows; i++) {
        mat[i] = [];
        for (let j = 0; j < cols; j++) {
          mat[i][j] = Math.floor(Math.random() * 19) - 9; // -9 to 9
        }
      }
      return mat;
    };
    if (target === 'A') this.matrixA.set(update(this.rowsA(), this.colsA()));
    else this.matrixB.set(update(this.rowsB(), this.colsB()));
  }

  fillIdentity(target: 'A' | 'B') {
    const update = (rows: number, cols: number) => {
      const mat: number[][] = [];
      for (let i = 0; i < rows; i++) {
        mat[i] = [];
        for (let j = 0; j < cols; j++) {
          mat[i][j] = i === j ? 1 : 0;
        }
      }
      return mat;
    };
    if (target === 'A') this.matrixA.set(update(this.rowsA(), this.colsA()));
    else this.matrixB.set(update(this.rowsB(), this.colsB()));
  }

  clearMatrix(target: 'A' | 'B') {
    const update = (rows: number, cols: number) => {
      const mat: number[][] = [];
      for (let i = 0; i < rows; i++) {
        mat[i] = new Array(cols).fill(0);
      }
      return mat;
    };
    if (target === 'A') this.matrixA.set(update(this.rowsA(), this.colsA()));
    else this.matrixB.set(update(this.rowsB(), this.colsB()));
  }

  // General determinant computation via LU decomposition / Gaussian Elimination
  private computeDeterminant(mat: number[][]): number {
    const n = mat.length;
    if (n === 0 || mat[0].length !== n) return NaN;
    if (n === 1) return mat[0][0];
    if (n === 2) return mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0];

    // Clone matrix to avoid mutation
    const a = mat.map(row => [...row]);
    let det = 1;

    for (let i = 0; i < n; i++) {
      let pivot = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) {
          pivot = j;
        }
      }

      if (Math.abs(a[pivot][i]) < 1e-12) return 0;

      if (pivot !== i) {
        const tmp = a[i];
        a[i] = a[pivot];
        a[pivot] = tmp;
        det = -det;
      }

      det *= a[i][i];

      for (let j = i + 1; j < n; j++) {
        const factor = a[j][i] / a[i][i];
        for (let k = i + 1; k < n; k++) {
          a[j][k] -= factor * a[i][k];
        }
      }
    }

    return det;
  }

  // General matrix inverse using Gauss-Jordan elimination with partial pivoting
  private computeInverse(mat: number[][]): number[][] | string {
    const n = mat.length;
    if (n === 0 || mat[0].length !== n) return 'Matrix must be square';

    // Augmented matrix [A | I]
    const aug: number[][] = [];
    for (let i = 0; i < n; i++) {
      aug[i] = new Array(2 * n).fill(0);
      for (let j = 0; j < n; j++) aug[i][j] = mat[i][j];
      aug[i][n + i] = 1;
    }

    for (let i = 0; i < n; i++) {
      let pivot = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(aug[j][i]) > Math.abs(aug[pivot][i])) {
          pivot = j;
        }
      }

      if (Math.abs(aug[pivot][i]) < 1e-12) {
        return 'Singular matrix (Determinant = 0, no inverse)';
      }

      if (pivot !== i) {
        const tmp = aug[i];
        aug[i] = aug[pivot];
        aug[pivot] = tmp;
      }

      const div = aug[i][i];
      for (let j = 0; j < 2 * n; j++) {
        aug[i][j] /= div;
      }

      for (let j = 0; j < n; j++) {
        if (j !== i) {
          const factor = aug[j][i];
          for (let k = 0; k < 2 * n; k++) {
            aug[j][k] -= factor * aug[i][k];
          }
        }
      }
    }

    const inv: number[][] = [];
    for (let i = 0; i < n; i++) {
      inv[i] = [];
      for (let j = 0; j < n; j++) {
        inv[i][j] = Number(aug[i][n + j].toFixed(4));
      }
    }
    return inv;
  }

  matrixResult = computed(() => {
    const a = this.matrixA();
    const b = this.matrixB();
    const op = this.matrixOp();
    const rowsA = a.length;
    const colsA = a[0]?.length || 0;
    const rowsB = b.length;
    const colsB = b[0]?.length || 0;

    try {
      if (op === 'add') {
        if (rowsA !== rowsB || colsA !== colsB) {
          return [['Error: Matrices must have identical dimensions for addition']];
        }
        return a.map((row, r) => row.map((val, c) => Number((val + b[r][c]).toFixed(4))));
      }
      if (op === 'subtract') {
        if (rowsA !== rowsB || colsA !== colsB) {
          return [['Error: Matrices must have identical dimensions for subtraction']];
        }
        return a.map((row, r) => row.map((val, c) => Number((val - b[r][c]).toFixed(4))));
      }
      if (op === 'scalar') {
        const k = this.matrixScalarVal();
        return a.map(row => row.map(val => Number((val * k).toFixed(4))));
      }
      if (op === 'transpose') {
        return a[0].map((_, c) => a.map(row => row[c]));
      }
      if (op === 'multiply') {
        if (colsA !== rowsB) {
          return [[`Error: Incompatible sizes (${rowsA}×${colsA} vs ${rowsB}×${colsB}). Columns of A must match Rows of B.`]];
        }
        const res: number[][] = [];
        for (let i = 0; i < rowsA; i++) {
          res[i] = [];
          for (let j = 0; j < colsB; j++) {
            let sum = 0;
            for (let k = 0; k < colsA; k++) {
              sum += a[i][k] * b[k][j];
            }
            res[i][j] = Number(sum.toFixed(4));
          }
        }
        return res;
      }
      if (op === 'determinant') {
        if (rowsA !== colsA) {
          return [['Error: Determinant requires a square matrix (N × N)']];
        }
        const det = this.computeDeterminant(a);
        return [[Number(det.toFixed(4))]];
      }
      if (op === 'invert') {
        if (rowsA !== colsA) {
          return [['Error: Inverse requires a square matrix (N × N)']];
        }
        const inv = this.computeInverse(a);
        if (typeof inv === 'string') return [[inv]];
        return inv;
      }
    } catch (e: any) {
      return [['Calculation error']];
    }
    return a;
  });

  // ==========================================
  // 2. Expression Evaluator with Scientific Functions
  // ==========================================
  expression = signal('sin(pi / 4) + sqrt(144) * 2^3');
  evalResult = computed(() => {
    try {
      let expr = this.expression().trim();
      if (!expr) return 'Enter math expression';

      // Replace power operator
      expr = expr.replace(/\^/g, '**');

      // Math constants and functions aliases
      const scope = {
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        asin: Math.asin,
        acos: Math.acos,
        atan: Math.atan,
        sqrt: Math.sqrt,
        cbrt: Math.cbrt,
        log: Math.log10,
        ln: Math.log,
        exp: Math.exp,
        abs: Math.abs,
        pi: Math.PI,
        PI: Math.PI,
        e: Math.E,
        floor: Math.floor,
        ceil: Math.ceil,
        round: Math.round
      };

      const fn = new Function(...Object.keys(scope), `return (${expr})`);
      const res = fn(...Object.values(scope));
      return typeof res === 'number' && !isNaN(res) ? String(Number(res.toFixed(8))) : 'Invalid expression';
    } catch {
      return 'Calculation error';
    }
  });

  // ==========================================
  // 3. Descriptive Statistics & Variance
  // ==========================================
  statsInput = signal('12, 18, 25, 4, 33, 19, 25, 41');
  numbers = computed(() => {
    return this.statsInput()
      .split(/[\s,]+/)
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n));
  });

  statsCount = computed(() => this.numbers().length);
  statsSum = computed(() => this.numbers().reduce((a, b) => a + b, 0));
  statsMean = computed(() => {
    const n = this.numbers();
    return n.length ? (this.statsSum() / n.length).toFixed(4) : '0';
  });
  statsMedian = computed(() => {
    const nums = [...this.numbers()].sort((a, b) => a - b);
    if (!nums.length) return 0;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 !== 0 ? nums[mid] : ((nums[mid - 1] + nums[mid]) / 2);
  });
  statsMin = computed(() => (this.numbers().length ? Math.min(...this.numbers()) : 0));
  statsMax = computed(() => (this.numbers().length ? Math.max(...this.numbers()) : 0));
  statsRange = computed(() => (this.numbers().length ? Number((this.statsMax() - this.statsMin()).toFixed(4)) : 0));
  statsVariance = computed(() => {
    const n = this.numbers();
    if (n.length < 2) return 0;
    const mean = Number(this.statsMean());
    const sumSquares = n.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
    return Number((sumSquares / (n.length - 1)).toFixed(4));
  });
  statsStdDev = computed(() => Number(Math.sqrt(this.statsVariance()).toFixed(4)));

  // ==========================================
  // 4. Percentage Tools
  // ==========================================
  percentA = signal(15);
  percentB = signal(200);
  percentResult = computed(() => ((this.percentA() / 100) * this.percentB()).toFixed(2));

  diffA = signal(50);
  diffB = signal(75);
  diffResult = computed(() => {
    if (this.diffA() === 0) return '0%';
    const pct = ((this.diffB() - this.diffA()) / this.diffA()) * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
  });

  // ==========================================
  // 5. Fractions & Ratios
  // ==========================================
  fracNum1 = signal(3);
  fracDen1 = signal(4);
  fracNum2 = signal(2);
  fracDen2 = signal(5);
  fracOp = signal<'+' | '-' | '*' | '/'>('+');

  fractionResult = computed(() => {
    const n1 = this.fracNum1();
    const d1 = this.fracDen1();
    const n2 = this.fracNum2();
    const d2 = this.fracDen2();
    if (d1 === 0 || d2 === 0) return 'Zero denominator error';

    let rNum = 0;
    let rDen = 1;

    switch (this.fracOp()) {
      case '+':
        rNum = n1 * d2 + n2 * d1;
        rDen = d1 * d2;
        break;
      case '-':
        rNum = n1 * d2 - n2 * d1;
        rDen = d1 * d2;
        break;
      case '*':
        rNum = n1 * n2;
        rDen = d1 * d2;
        break;
      case '/':
        if (n2 === 0) return 'Division by zero';
        rNum = n1 * d2;
        rDen = d1 * n2;
        break;
    }

    // Simplify fraction
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const common = Math.abs(gcd(rNum, rDen));
    const simpleNum = rNum / common;
    const simpleDen = rDen / common;
    const dec = (simpleNum / simpleDen).toFixed(4);

    return `${simpleNum} / ${simpleDen}  (≈ ${dec})`;
  });

  // ==========================================
  // 6. Prime Factors & GCD / LCM
  // ==========================================
  primeNum = signal(84);
  primeFactors = computed(() => {
    let n = Math.abs(Math.floor(this.primeNum()));
    if (n < 2) return [n];
    const factors: number[] = [];
    let d = 2;
    while (d * d <= n) {
      while (n % d === 0) {
        factors.push(d);
        n /= d;
      }
      d++;
    }
    if (n > 1) factors.push(n);
    return factors;
  });

  isPrime = computed(() => {
    const n = Math.abs(Math.floor(this.primeNum()));
    if (n <= 1) return false;
    for (let i = 2; i * i <= n; i++) {
      if (n % i === 0) return false;
    }
    return true;
  });

  gcdA = signal(48);
  gcdB = signal(18);
  gcdResult = computed(() => {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const a = Math.abs(this.gcdA());
    const b = Math.abs(this.gcdB());
    const g = gcd(a, b);
    const lcm = a && b ? (a * b) / g : 0;
    return { gcd: g, lcm: lcm };
  });

  // ==========================================
  // 7. 2D & 3D Geometry
  // ==========================================
  geoShape = signal<'circle' | 'rectangle' | 'triangle' | 'sphere' | 'cylinder'>('circle');
  geoRadius = signal(5);
  geoWidth = signal(8);
  geoHeight = signal(6);

  geoResult = computed(() => {
    const shape = this.geoShape();
    const r = this.geoRadius();
    const w = this.geoWidth();
    const h = this.geoHeight();

    if (shape === 'circle') {
      const area = Math.PI * r * r;
      const perimeter = 2 * Math.PI * r;
      return { p1: `Area = ${area.toFixed(4)}`, p2: `Circumference = ${perimeter.toFixed(4)}` };
    }
    if (shape === 'rectangle') {
      const area = w * h;
      const perimeter = 2 * (w + h);
      return { p1: `Area = ${area.toFixed(4)}`, p2: `Perimeter = ${perimeter.toFixed(4)}` };
    }
    if (shape === 'triangle') {
      const area = 0.5 * w * h;
      const hyp = Math.sqrt(w * w + h * h);
      return { p1: `Area = ${area.toFixed(4)}`, p2: `Hypotenuse = ${hyp.toFixed(4)}` };
    }
    if (shape === 'sphere') {
      const vol = (4 / 3) * Math.PI * Math.pow(r, 3);
      const surface = 4 * Math.PI * r * r;
      return { p1: `Volume = ${vol.toFixed(4)}`, p2: `Surface Area = ${surface.toFixed(4)}` };
    }
    if (shape === 'cylinder') {
      const vol = Math.PI * r * r * h;
      const surface = 2 * Math.PI * r * (r + h);
      return { p1: `Volume = ${vol.toFixed(4)}`, p2: `Surface Area = ${surface.toFixed(4)}` };
    }
    return { p1: '', p2: '' };
  });

  copy(val: any) {
    navigator.clipboard.writeText(String(val));
  }
}
