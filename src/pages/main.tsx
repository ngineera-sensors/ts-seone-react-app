import { FC, useEffect, useRef, useState } from "react";
import { useMqttState } from "mqtt-react-hooks";
import { useSubscription } from 'mqtt-react-hooks';

import uPlot from "uplot";
import { Row, Col, Button, Space, Slider, Typography } from 'antd'
import { peptideColorPaletteVdW } from "../colormap";
import { color2rgba } from "../utils";
import { forEachChild } from "typescript";


interface Histograms {
    Normalized: number[],
    White: number[],
    Flat: number[]
}

interface Size {
    Width: number,
    Height: number
}

// interface Value {
//     I: number,
//     Peptide: number,
//     Area: number,

//     Sum: number,
//     Mean: number,
//     SpatialStd: number
//     TemporalStd: number,

//     WhiteSum: number,
//     WhiteMean: number,
//     WhiteSpatialStd: number,
//     WhiteTemporalStd: number,

//     AbsolutePosition: {
//         X: number,
//         Y: number
//     },
//     GridPosition: {
//         X: number,
//         Y: number,
//     }
//     OuterEllipseSize: Size,
//     InnerEllipseSize: Size,
// }

interface Frame {
    I: number,
    Timestamp: number,
    Values: number[]
}

const maxNFrames= 100;

enum CommandType {
    StartCamera = 0,
    StopCamera,
    SetCameraTargetExposureMs,
    GetCameraTargetExposureMs,
    SetCameraTargetExposureOnFlatMs,
    GetCameraTargetExposureOnFlatMs,
    SetCameraTargetFrequencyHz,
    GetCameraTargetFrequencyHz,
    SetCameraTargetPixelClockHz,
    GetCameraTargetPixelClockHz,
    SetCameraAOIX,
    GetCameraAOIX,
    SetCameraAOIY,
    GetCameraAOIY,
    SetCameraAOIWidth,
    GetCameraAOIWidth,
    SetCameraAOIHeight,
    GetCameraAOIHeight,
    SetCameraBinning,
    GetCameraBinning,
    SetMeasureMasterNFrames,
    SetDarkMasterDelaySecs,
    SetFlatMasterDelaySecs,
    SetPump,
    SetLED,
    SetLCS,
    ExecuteSpotDetectionSequence,
    ExecuteCalibrationSequence,
}

const ConfigButton: FC<{
    cmd: CommandType
}> = (props: {
    cmd: CommandType
}) => {
    const { cmd } = props;
    const { client } = useMqttState();

    return <>
        <Button
            onClick={() => {
                if (client !== undefined && client !== null) {
                    console.log(`${CommandType[cmd]} button`)
                    client.publish(
                        "fspdriver/commands",
                        JSON.stringify({
                            CmdType: cmd,
                            Value: 0
                        })
                    )
                }
            }}
        >{CommandType[cmd]}</Button>
    </>
}

const ConfigSlider: FC<{
    cmd: CommandType,
    min: number,
    max: number,
}> = (props: {
    cmd: CommandType,
    min: number,
    max: number,
}) => {
    const [ valueState, setValue ] = useState<number>();
    const { client } = useMqttState();
    const { cmd, min, max } = props;
    return <div className="paper">
        <Typography.Title level={5}>{CommandType[cmd]}</Typography.Title>
        <Slider
            style={{width: '80%'}}
            min={min}
            max={max}
            onAfterChange={(value) => {
                if (client !== undefined && client !== null) {
                    console.log(`${CommandType[cmd]} slider: ${value}`)
                    setValue(value);
                    client.publish(
                        "fspdriver/commands",
                        JSON.stringify({
                            CmdType: cmd,
                            Value: value
                        })
                    )
                }
            }}
        />
        <Space style={{width: '100%'}}>
            <span>{valueState}</span>
        </Space>
    </div>
}

const CommandResponseListener: FC<{
    cmd: CommandType,
}> = (props: {
    cmd: CommandType,
}) => {
    const { cmd } = props;
    const { message } = useSubscription([
        `fspdriver/commands/response`,
    ]);
    const [ payload, setPayload ] = useState('');

    useEffect(() => {
        if (message !== undefined && typeof message.message === 'string') {
            console.log(message.message)
            var resp: {
                CmdType: CommandType,
                Value: any
            } = JSON.parse(message.message)
            if (resp.CmdType === cmd) {
                setPayload(resp.Value)
            }
        }
    }, [message])
    return <div className="paper">
        {payload}
    </div>
}

const HistogramListener: FC = () => {
    const { message } = useSubscription([
        `fspdriver/histograms`,
    ]);

    const [hists, setHists] = useState<Histograms>();
    const divRef = useRef<HTMLDivElement | null>(null);
    const uplotBox = useRef<uPlot | null>(null);

    useEffect(() => {
        if (message !== undefined && typeof message.message === 'string') {
            setHists(JSON.parse(message.message))
        }
    }, [message])

    useEffect(() => {
        if (hists === undefined) {
            return
        }
        if (divRef.current === null) {
            return
        }
        var data: Float32Array[] = [
            Float32Array.from(hists.Normalized.map((v, i) => i)),
            Float32Array.from(hists.Flat),
            Float32Array.from(hists.White),
            Float32Array.from(hists.Normalized)
        ]
        // console.log(data)
        var series = [
            {},
            {
                show: true,
                label: 'Flat',
                stroke: 'red',
                width: 1,
            },
            {
                show: true,
                label: 'White',
                stroke: 'green',
                width: 1,
            },
            {
                show: true,
                label: 'Normalized',
                stroke: 'blue',
                width: 1,
            }
        ]
        var opts = {
            title: "Histogram",
            id: 'uplot-hist',
            width: 400,
            height: 250,
            legend: {
                show: true,
            },
            scales: {
                x: {
                    time: false
                }
            },
            series: series
        }
        if (uplotBox.current !== null) {
            // console.log("Hist: setting data to existing plot")
            uplotBox.current.setData(data)
        } else {
            // console.log("Hist: creating new instance of uPlot")
            uplotBox.current = new uPlot(opts, data, divRef.current)
        }
    }, [hists])

    return <>
        <Row>
            <Col>
                <div ref={divRef}></div>
            </Col>
        </Row>
    </>
}

const ImageListener: FC <{imageType: string}>= (props: {imageType: string}) => {
    const { imageType } = props;
    const { message } = useSubscription([
        `fspdriver/images/${imageType}`,
    ]);
    // const divRef = useRef<HTMLDivElement>(null);
    const [img, setImg] = useState<string>();

    useEffect(() => {
        if (message !== undefined && typeof message.message === 'string') {
            setImg(message.message)
        }
    }, [message])
    return (
        <>
            <div>
                <img width='400px' height='250px' src={`data:image/png;base64, ${img}`} alt={`SPRi Image (${imageType})`}></img>
            </div>
        </>
      );
}

const FramesListener: FC<{
    valueField: string,
    offsetToZero: boolean
}> = (props: {
    valueField: string,
    offsetToZero: boolean
}) => {

    const { valueField, offsetToZero } = props;

    const [ frames, setFrames ] = useState<Frame[]>([]);
    const [ framesCounter, setFramesCounter ] = useState(0);
    const [ zeroFrame, setZeroFrame ] = useState<Frame>();

    const [ meanValue, setMeanValue ] = useState<number>(0);
    const [ minValue, setMinValue ] = useState<number>(0);
    const [ maxValue, setMaxValue ] = useState<number>(0);
    const [ allTimeMaxMean, setAllTimeMaxMeanValue ] = useState<number>(0);

    const { message } = useSubscription([
        'fspdriver/frames/mzi',
    ]);

    const divRef = useRef<HTMLDivElement | null>(null);
    const uplotBox = useRef<uPlot | null>(null);

    useEffect(() => {
        if (message === undefined || typeof message.message !== "string") {
            return 
        }
        const frame: Frame = JSON.parse(message.message);
        if (frames.length == 0 && offsetToZero) {
            setZeroFrame({...frame});
        }
        let _frames = [...frames];
        if (frames.length >= maxNFrames){
            _frames.shift()
        }
        // let excludedValues = [
        //     1,
        //     9,
        //     4,
        //     20,
        //     25,
        //     26,
        //     27,
        //     42,
        //     43,
        //     46,
        //     55,
        //     61
        // ]
        // frame.Values = frame.Values.filter((v, i) => {
        //     if (excludedValues.includes(i)) {
        //         return false
        //     }
        //     return true
        // })
        // console.log(frame.Values)
        _frames.push(frame)
        setFrames(_frames)
        setFramesCounter(framesCounter+1)
    }, [message])

    useEffect(() => {

        if (frames.length === 0) {
            return
        }
    
        if (divRef.current === null) {
            return
        }
    
        const nSeries = frames[0].Values.length;
        const nFrames = frames.length;
        
        let data = new Array<Float32Array>(nSeries+1);
        data[0] = new Float32Array(nFrames)
        for (let i=0;i<nSeries;i++) {
            data[i+1] = new Float32Array(nFrames);
        }
    
        for (let j=0; j<nFrames;j++) {
            let frame = frames[j]
            data[0][j] = frame.I;
            for (let i=0;i<nSeries;i++) {
                let v = frame.Values[i];
                if (zeroFrame) {
                    v -= zeroFrame.Values[i];
                }
                data[i+1][j] = v;
            }
        }
        let series: uPlot.Series[] = []
        for (let i=0;i<nSeries;i++) {
            if (i === 0) {
                series.push({label: 'Idx'})
            }
            let peptide = i;
            let shortPeptide = peptide;
            if (shortPeptide >= 100) {
                shortPeptide = Math.floor(peptide/10)
            }
            var color = 'black'
            try {
                color = color2rgba(peptideColorPaletteVdW[shortPeptide], 1)
            } catch (e) {
    
            }
            series.push({ 
                show: true,
                label: `${peptide}`,
                stroke: color,
                width: 1,
                
            })
        }
    
        let name = `${valueField} (offset: ${offsetToZero})`
        const opts: uPlot.Options = {
            title: name,
            id: name,
            width: 400,
            height: 250,
            legend: {
                show: false,
            },
            cursor: {
                show: true,
                x: true,
                y: true,
                lock: true,
            },
            scales: {
                x: {
                    time: false
                }
            },
            series: series,
        }
        
        var _min = 1e6;
        var _max = -1e6;
        var _sum = 0;
        var _cnt = 0;
        frames.slice(-5).forEach(frame => {
            frame.Values.forEach((value, i)=> {
                let _v = value;
                if (zeroFrame) {
                    _v -= zeroFrame.Values[i]
                }
                _min = Math.min(_min, _v)
                _max = Math.max(_max, _v)
                _sum += _v;
                _cnt ++
            })
        })
        var _mean = _sum/_cnt;
        var _allTimeMaxMean = Math.max(allTimeMaxMean, _mean)

        setAllTimeMaxMeanValue(_allTimeMaxMean);
        setMeanValue(_mean);
        setMinValue(_min);
        setMaxValue(_max);

        if (uplotBox.current !== null) {
            // console.log("Setting data to existing plot")
            uplotBox.current.setData(data)
        } else {
            // console.log("Creating new instance of uPlot")
            uplotBox.current = new uPlot(opts, data, divRef.current)
        }
    }, [framesCounter])

    const resetValues = () => {
        setAllTimeMaxMeanValue(0);
    }

    return (
        <>
        <Row>
            <Col>
                <div ref={divRef}></div>
            </Col>
        </Row>
        <Row justify="start" gutter={[20, 20]}>
            {offsetToZero ?
            <Col>
                <Button
                    onClick={() => {
                        setZeroFrame(frames[frames.length-1])
                    }}
                >
                    Re-zero
                </Button>
            </Col> : null }
            <Col>
                <Button
                    onClick={() => {
                        setFrames([])
                        resetValues()
                    }}
                >
                    Clear
                </Button>
            </Col>
            <Col>
                <div>
                    {`${meanValue.toFixed(3)} [${minValue.toFixed(3)} : ${maxValue.toFixed(3)}]`}
                </div>  
            </Col>
            <Col>
                <div>
                    Max mean: {allTimeMaxMean.toFixed(3)}
                </div>  
            </Col>
        </Row>
        </>
      );
}

// const FramesRatioListener: FC<{
//     numeratorValueField: string,
//     denominatorValueField: string,
//     offsetToZero: boolean
// }> = (props: {
//     numeratorValueField: string,
//     denominatorValueField: string,
//     offsetToZero: boolean
// }) => {

//     const { numeratorValueField, denominatorValueField, offsetToZero } = props;

//     const [ frames, setFrames ] = useState<Frame[]>([]);
//     const [ framesCounter, setFramesCounter ] = useState(0);
//     const [ zeroFrame, setZeroFrame ] = useState<Frame>();

//     const [ meanValue, setMeanValue ] = useState<number>(0);
//     const [ minValue, setMinValue ] = useState<number>(0);
//     const [ maxValue, setMaxValue ] = useState<number>(0);
//     const [ allTimeMaxMean, setAllTimeMaxMeanValue ] = useState<number>(0);

//     const { message } = useSubscription([
//         'fspdriver/frame',
//     ]);

//     const divRef = useRef<HTMLDivElement | null>(null);
//     const uplotBox = useRef<uPlot | null>(null);

//     useEffect(() => {
//         if (message === undefined || typeof message.message !== "string") {
//             return 
//         }
//         const frame: Frame = JSON.parse(message.message);
//         if (frames.length == 0 && offsetToZero) {
//             setZeroFrame({...frame});
//         }
//         let _frames = [...frames];
//         if (frames.length >= maxNFrames){
//             _frames.shift()
//         }
//         _frames.push(frame)
//         setFrames(_frames)
//         setFramesCounter(framesCounter+1)
//     }, [message])

//     useEffect(() => {

//         if (frames.length === 0) {
//             return
//         }
    
//         if (divRef.current === null) {
//             return
//         }
    
//         const nSeries = frames[0].Values.length;
//         const nFrames = frames.length;
        
//         let data = new Array<Float32Array>(nSeries+1);
//         data[0] = new Float32Array(nFrames)
//         for (let i=0;i<nSeries;i++) {
//             data[i+1] = new Float32Array(nFrames);
//         }
    
//         for (let j=0; j<nFrames;j++) {
//             let frame = frames[j]
//             data[0][j] = frame.I;
//             for (let i=0;i<nSeries;i++) {
//                 let nv = frame.Values[i][numeratorValueField as keyof Value] as number;
//                 let dv = frame.Values[i][denominatorValueField as keyof Value] as number;
//                 let v = nv / dv;
//                 if (zeroFrame) {
//                     let z_nv = zeroFrame.Values[i][numeratorValueField as keyof Value] as number;
//                     let z_dv = zeroFrame.Values[i][denominatorValueField as keyof Value] as number;
//                     let z_v = z_nv / z_dv;
//                     v -= z_v;
//                 }
//                 data[i+1][j] = v;
//             }
//         }
//         let series: uPlot.Series[] = []
//         for (let i=0;i<nSeries;i++) {
//             if (i === 0) {
//                 series.push({label: 'Idx'})
//             }
//             let peptide = frames[0].Values[i].Peptide;
//             let shortPeptide = peptide;
//             if (shortPeptide >= 100) {
//                 shortPeptide = Math.floor(peptide/10)
//             }
//             var color = 'black'
//             try {
//                 color = color2rgba(peptideColorPaletteVdW[shortPeptide], 1)
//             } catch (e) {
    
//             }
//             series.push({ 
//                 show: true,
//                 label: `${peptide}`,
//                 stroke: color,
//                 width: 1,
                
//             })
//         }
    
//         let name = `${numeratorValueField}/${denominatorValueField} (offset: ${offsetToZero})`
//         const opts: uPlot.Options = {
//             title: name,
//             id: name,
//             width: 400,
//             height: 250,
//             legend: {
//                 show: false,
//             },
//             cursor: {
//                 show: true,
//                 x: true,
//                 y: true,
//                 lock: true,
//             },
//             scales: {
//                 x: {
//                     time: false
//                 }
//             },
//             series: series,
//         }
        
//         var _min = 1e6;
//         var _max = -1e6;
//         var _sum = 0;
//         var _cnt = 0;
//         frames.slice(-5).forEach(frame => {
//             frame.Values.forEach((value, i)=> {
//                 let nv = frame.Values[i][numeratorValueField as keyof Value] as number;
//                 let dv = frame.Values[i][denominatorValueField as keyof Value] as number;
//                 let _v = nv / dv;
//                 if (zeroFrame) {
//                     let z_nv = zeroFrame.Values[i][numeratorValueField as keyof Value] as number;
//                     let z_dv = zeroFrame.Values[i][denominatorValueField as keyof Value] as number;
//                     let z_v = z_nv / z_dv;
//                     _v -= z_v;
//                 }
//                 _min = Math.min(_min, _v)
//                 _max = Math.max(_max, _v)
//                 _sum += _v;
//                 _cnt ++
//             })
//         })
//         var _mean = _sum/_cnt;
//         var _allTimeMaxMean = Math.max(allTimeMaxMean, _mean)

//         setAllTimeMaxMeanValue(_allTimeMaxMean);
//         setMeanValue(_mean);
//         setMinValue(_min);
//         setMaxValue(_max);

//         if (uplotBox.current !== null) {
//             // console.log("Setting data to existing plot")
//             uplotBox.current.setData(data)
//         } else {
//             // console.log("Creating new instance of uPlot")
//             uplotBox.current = new uPlot(opts, data, divRef.current)
//         }
//     }, [framesCounter])

//     const resetValues = () => {
//         setAllTimeMaxMeanValue(0);
//     }

//     return (
//         <>
//         <Row>
//             <Col>
//                 <div ref={divRef}></div>
//             </Col>
//         </Row>
//         <Row justify="start" gutter={[20, 20]}>
//             {offsetToZero ?
//             <Col>
//                 <Button
//                     onClick={() => {
//                         setZeroFrame(frames[frames.length-1])
//                     }}
//                 >
//                     Re-zero
//                 </Button>
//             </Col> : null }
//             <Col>
//                 <Button
//                     onClick={() => {
//                         setFrames([])
//                         resetValues()
//                     }}
//                 >
//                     Clear
//                 </Button>
//             </Col>
//             <Col>
//                 <div>
//                     {`${meanValue.toFixed(3)} [${minValue.toFixed(3)} : ${maxValue.toFixed(3)}]`}
//                 </div>  
//             </Col>
//             <Col>
//                 <div>
//                     Max mean: {allTimeMaxMean.toFixed(3)}
//                 </div>  
//             </Col>
//         </Row>
//         </>
//       );
// }

export const MainPage: FC = () => {
    const { connectionStatus } = useMqttState();
    return <div>
        <Row justify="center">
            <Col span={18} >
                <Row justify="center">
                    <Col span={24}>
                        <div className="paper"><span>Connection status: {connectionStatus.toString()}</span></div>
                    </Col>
                    <Col span={12}>
                        <div className="paper">
                            <FramesListener
                                valueField="Mean"
                                offsetToZero={true}
                            />
                        </div>
                    </Col>
                    <Col span={12}>
                        <div className="paper">
                            <FramesListener
                                valueField="Mean"
                                offsetToZero={false}
                            />
                        </div>
                    </Col>
                    {/* <Col span={12}>
                        <div className="paper">
                            <FramesRatioListener
                                numeratorValueField="WhiteMean"
                                denominatorValueField="CameraEffectiveExposure"
                                offsetToZero={false}
                            />
                        </div>
                    </Col> */}
                    {/* <Col span={12}>
                        <div className="paper">
                            <FramesListener
                                valueField="WhiteMean"
                                offsetToZero={false}
                            />
                        </div>
                    </Col> */}
                    <Col span={12}>
                        <div className="paper">
                            <ImageListener imageType="drawing"/>
                        </div>
                    </Col>
                    <Col span={12}>
                        <div className="paper">
                            <ImageListener imageType="raw"/>
                        </div>
                    </Col>
                </Row>
                <Row>
                    <Col span={12}>
                        <div className="paper">
                            <HistogramListener/>
                        </div>
                    </Col>
                </Row>
            </Col>
            {/* <Col span={6}>
                <ConfigSlider
                    cmd={CommandType.SetPump}
                    min={0}
                    max={255}
                />
                <ConfigSlider
                    cmd={CommandType.SetMeasureMasterNFrames}
                    min={4}
                    max={20}
                />
                <ConfigSlider
                    cmd={CommandType.SetDarkMasterDelaySecs}
                    min={1}
                    max={10}
                />
                <ConfigSlider
                    cmd={CommandType.SetFlatMasterDelaySecs}
                    min={1}
                    max={10}
                />
                <ConfigSlider
                    cmd={CommandType.SetCameraTargetExposureMs}
                    min={10}
                    max={100}
                />
                <ConfigSlider
                    cmd={CommandType.SetCameraTargetExposureOnFlatMs}
                    min={10}
                    max={100}
                />
                <ConfigSlider
                    cmd={CommandType.SetCameraAOIX}
                    min={0}
                    max={1400}
                />
                <ConfigSlider
                    cmd={CommandType.SetCameraAOIY}
                    min={0}
                    max={1400}
                />
                <CommandResponseListener
                    cmd={CommandType.GetCameraAOIX}
                />
                <CommandResponseListener
                    cmd={CommandType.GetCameraAOIY}
                />
                <div className="paper">
                    <Space direction="vertical" align="start">
                        <ConfigButton
                            cmd={CommandType.ExecuteSpotDetectionSequence}
                        />
                        <ConfigButton
                            cmd={CommandType.StartCamera}
                        />
                        <ConfigButton
                            cmd={CommandType.StopCamera}
                        />
                        <ConfigButton
                            cmd={CommandType.GetCameraAOIX}
                        />
                        <ConfigButton
                            cmd={CommandType.GetCameraAOIY}
                        />
                    </Space>
                </div>
            </Col> */}
        </Row>
    </div>
}