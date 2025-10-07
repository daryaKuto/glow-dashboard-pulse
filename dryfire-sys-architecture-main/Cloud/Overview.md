# ThingsBoard Overview

* ThingsBoard API is the primary interface for integrating external applications, devices, and services with the ThingsBoard IoT platform.   

* The API is divided into two main parts:   
  * The Device API, which supports multiple IoT communication protocols, such as MQTT, HTTP, and CoAP for device connectivity *\[DryFire Device use MQTT\]*  
  * The Server-side API, which is exposed as a REST API for managing and interacting with platform entities like devices, assets, telemetry, and users

* The Device API enables seamless onboarding and real-time communication with IoT devices, while the Server-side REST API provides endpoints for administration, querying telemetry and attributes, executing remote procedure calls (RPC), and managing entities and their relationships.  

* To make working with the REST API more accessible and developer-friendly, ThingsBoard provides a **Swagger UI** interface.
  * Swagger is an open-source tool that offers interactive, web-based documentation for REST APIs.   
  * With Swagger UI, developers can explore available endpoints, view request and response formats, and test API calls directly from their browser—making it easier to learn, prototype, and debug integrations with ThingsBoard

<br>

In summary, ThingsBoard’s API *augmented by Swagger documentation* enables robust, scalable, and flexible integration for IoT solutions, supporting both device-level and server-side operations through standardized, well-documented interfaces.

##

[Back to Thingsboard Main Page](./Thingsboard.md)

[Back to Main page](../README.md)