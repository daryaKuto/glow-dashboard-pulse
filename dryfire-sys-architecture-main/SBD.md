# Firmware

## Block Diagram

```mermaid

graph TD

    classDef APP fill:#d9ead3, stroke:#666666, stroke-width:1px, color:black
    classDef MID fill:#c9daf8, stroke:#666666, stroke-width:1px, color:black
    classDef DRV fill:#ead1dc, stroke:#666666, stroke-width:1px, color:black
    classDef MOD fill:#ffffff, stroke:black, stroke-width:1px, color:black

    subgraph Application
        Main(Main)
        Config(Config)
        Reset(Reset)
        Led(Led)
        Buzzer(Buzzer)
        Tuner(Tuner)
        BLE_Host(BLE_Host)
        Device_Manager(Device_Manager)
        CLOUD_Host(CLOUD_Host)
        MQTT_Client(MQTT_Client)
        WiFi_Device(WiFi_Device)
        Debug(Debug)
    end

    subgraph Middleware
        Isr(Isr)
        Soft_Timer(Soft_Timer)
        LDR_Lib(LDR_Lib)
        ALS_Lib(ALS_Lib)
        Audio_Lib(Audio_Lib)
        BLE_Lib(BLE_Lib)
        WiFi_Lib(WiFi_Lib)
    end

    subgraph Drivers
        Timer(Timer)
        GPIO_Driver(GPIO_Driver)
        UART_Driver(UART_Driver)
        ADC_Driver(ADC_Driver)
        I2C_Driver(I2C_Driver)
        I2S_Driver(I2S_Driver)
        BLE_Driver(BLE_Driver)
        WiFi_Driver(WiFi_Driver)
        USB_Driver(USB_Driver)
    end

    BLE_Host <--> BLE_Lib <--> BLE_Driver
    WiFi_Device <--> WiFi_Lib <--> WiFi_Driver
    MQTT_Client <--> WiFi_Device
    CLOUD_Host <--> MQTT_Client
    Device_Manager <--> CLOUD_Host
    Device_Manager <--> BLE_Host
    Main --> Buzzer <--> Audio_Lib <--> I2S_Driver
    Tuner <--> LDR_Lib <--> ADC_Driver
    Tuner <--> ALS_Lib <--> I2C_Driver
    Config --> Main
    Main --> Led <--> Isr
    Debug <--> Isr <--> UART_Driver
    Reset <--> Isr <--> GPIO_Driver
    Soft_Timer <--> Timer
    Main <--> Debug
    Main <---> Tuner

    
    class Application MOD
    class Middleware MOD
    class Drivers MOD

    class Main APP
    class Led APP
    class Config APP
    class Reset APP
    class Led APP
    class Buzzer APP
    class Tuner APP
    class Device_Manager APP
    class BLE_Host APP
    class CLOUD_Host APP
    class MQTT_Client APP
    class WiFi_Device APP
    class Debug APP

    class GPIO_Driver DRV
    class UART_Driver DRV
    class Timer DRV
    class ADC_Driver DRV
    class I2C_Driver DRV
    class I2S_Driver DRV
    class BLE_Driver DRV
    class WiFi_Driver DRV
    class USB_Driver DRV

    class Isr MID
    class Soft_Timer MID
    class LDR_Lib MID
    class ALS_Lib MID
    class Audio_Lib MID
    class BLE_Lib MID
    class WiFi_Lib MID
    class BLE_Lib MID

    linkStyle default stroke:black, color:black;

    
```

<br>
<br>
<br>
<br>

[Back to Main page](./README.md)