# Dryfire System Architecture

# Intro
Dryfire is a target practice device designed to be used in academy's for mock training and at homes for fun.

<br>

# System Diagram
```mermaid
graph LR
    classDef RED fill:#f4cccc, stroke:#666666, stroke-width:1px, color:black;
    classDef BLUE fill:#c9daf8, stroke:#666666, stroke-width:1px, color:black;
    classDef LED fill:#ead1dc, stroke:#666666, stroke-width:1px, color:black; 
    classDef YLLW fill:#fff2cc, stroke:#666666, stroke-width:1px, color:black; 
    classDef PRPL fill:#d9d2e9, stroke:#666666, stroke-width:1px, color:black; 
    classDef GREN fill:#d9ead3, stroke:#666666, stroke-width:1px, color:black; 

    CLOUD_Server(CLOUD_Server)
    Mobile_App(Mobile_App)
    Dryfire_Target(Dryfire_Target)
    Laser_Gun(Laser_Gun)

    class CLOUD_Server BLUE;
    class Mobile_App YLLW;
    class Dryfire_Target GREN;
    class Laser_Gun PRPL;


    CLOUD_Server -- WiFi <--> Dryfire_Target
    Mobile_App -- BLE <--> Dryfire_Target
    Dryfire_Target x-- Light --x Laser_Gun
    

```

<br>

# Usecases
## Initialization
- User should see an LED indication when he switches ON the device
- User should be able to find the current state of the device from it's LED indication
- User should be able to reset the device using the reset button

## Provisioning
- User should be able to provision the device with ID, WiFi and CLOUD settings via a Mobile_App
- User should be able to factory reset the device using the reset button

## Gaming & Monitoring
- User should be able to setup the device to be part of a game using a Mobile app via the CLOUD
- User should be dynamically activate or deactivate the device as a part of a game scenario
- When the user hits the target accurately with the laser provide a light and buzzer indication
- User should be able to check the status of the device or game in the CLOUD dashboard
- User should be able to use the device both indoors and outdoors

<br>

# Sequence Diagrams
- [Sequence Diagrams](./SEQ.md)

<br>

# Harware
- [Hardware Block Diagram](./HBD.md)

<br>

# Firmware
- [Software Block Diagram](./SBD.md)

<br>

# Cloud Backend
- [CLOUD Architecture](./CLOUD.md)
- [Thingsboard](./Cloud/Thingsboard.md)

<br>

# Mobile Backend
...
