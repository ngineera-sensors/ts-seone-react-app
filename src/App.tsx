import React from 'react';
import logo from './logo.svg';
import './App.css';

import {v4 as uuidv4} from 'uuid';

import { Connector } from 'mqtt-react-hooks';
import { MainPage } from './pages/main';
import Layout, { Content, Footer, Header } from 'antd/lib/layout/layout';
import { Typography } from 'antd';

function App() {
  return (
    <div className="App">
      <Layout>
        <Header>
          <Typography.Title level={2} style={{color: 'white'}}>SPRi App</Typography.Title>
        </Header>
        <Content>
          <Connector
            brokerUrl='ws://192.168.1.57:9001'
            options={{
            clientId: uuidv4()
            }}
          >
            <MainPage/>
          </Connector>
        </Content>
        <Footer>

        </Footer>
      </Layout>
    </div>
  );
}

export default App;
