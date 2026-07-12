#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include "../globals.h"

void setupWiFi();
void jagaWiFi();
void jagaMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void publishData();
void handleOTA();

#endif
