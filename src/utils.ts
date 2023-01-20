
export const transpose = (a: number[][]): number[][] => {
    return a[0].map((col, i) => a.map(row => row[i]))
}

export const color2rgba = (c: number[], a: number): string => {
    const [r, g, b] = c;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
};