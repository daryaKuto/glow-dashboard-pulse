#!/bin/bash

# Test WiFi Credentials Pull from ThingsBoard
# This script tests the actual WiFi credentials retrieval from ThingsBoard API
# No placeholder or fake data - uses real ThingsBoard API calls

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TB_BASE_URL="https://thingsboard.cloud"
TB_USERNAME="${VITE_TB_USERNAME:-andrew.tam@gmail.com}"
TB_PASSWORD="${VITE_TB_PASSWORD:-dryfire2025}"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed. Install with: brew install jq"
        exit 1
    fi
    
    log_success "All dependencies are available"
}

# Authenticate with ThingsBoard and get JWT token
authenticate() {
    log "Authenticating with ThingsBoard..."
    
    local auth_response=$(curl -s -X POST \
        "${TB_BASE_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"${TB_USERNAME}\",
            \"password\": \"${TB_PASSWORD}\"
        }")
    
    if [ $? -ne 0 ]; then
        log_error "Failed to connect to ThingsBoard"
        exit 1
    fi
    
    # Extract token from response
    JWT_TOKEN=$(echo "$auth_response" | jq -r '.token // empty')
    
    if [ -z "$JWT_TOKEN" ] || [ "$JWT_TOKEN" = "null" ]; then
        log_error "Failed to authenticate with ThingsBoard"
        log_error "Response: $auth_response"
        exit 1
    fi
    
    log_success "Successfully authenticated with ThingsBoard"
    log "Token: ${JWT_TOKEN:0:20}..."
}

# Get list of devices from ThingsBoard
get_devices() {
    log "Fetching devices from ThingsBoard..."
    
    local devices_response=$(curl -s -X GET \
        "${TB_BASE_URL}/api/tenant/devices?pageSize=100&page=0" \
        -H "Authorization: Bearer ${JWT_TOKEN}")
    
    if [ $? -ne 0 ]; then
        log_error "Failed to fetch devices from ThingsBoard"
        exit 1
    fi
    
    # Check if response contains data
    local device_count=$(echo "$devices_response" | jq '.data | length // 0')
    
    if [ "$device_count" -eq 0 ]; then
        log_warning "No devices found in ThingsBoard"
        return 1
    fi
    
    log_success "Found $device_count devices"
    
    # Store devices for processing
    DEVICES_JSON="$devices_response"
    return 0
}

# Get WiFi credentials from a specific device
get_device_wifi_credentials() {
    local device_id="$1"
    local device_name="$2"
    
    log "Checking WiFi credentials for device: $device_name ($device_id)"
    
    # Get device attributes (SHARED_SCOPE)
    local attributes_response=$(curl -s -X GET \
        "${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${device_id}/values/attributes/SHARED_SCOPE" \
        -H "Authorization: Bearer ${JWT_TOKEN}")
    
    if [ $? -ne 0 ]; then
        log_error "Failed to fetch attributes for device $device_name"
        return 1
    fi
    
    # Check if attributes exist
    local attributes_count=$(echo "$attributes_response" | jq 'length // 0')
    
    if [ "$attributes_count" -eq 0 ]; then
        log_warning "No attributes found for device $device_name"
        return 1
    fi
    
    # Extract WiFi credentials
    local wifi_ssid=$(echo "$attributes_response" | jq -r '.[] | .wifi_ssid // .ssid // empty' 2>/dev/null | head -1)
    local wifi_password=$(echo "$attributes_response" | jq -r '.[] | .wifi_password // .password // empty' 2>/dev/null | head -1)
    
    # Check if WiFi credentials exist
    if [ -z "$wifi_ssid" ] && [ -z "$wifi_password" ]; then
        log_warning "No WiFi credentials found for device $device_name"
        return 1
    fi
    
    # Display WiFi credentials (mask password for security)
    log_success "WiFi credentials found for device: $device_name"
    echo "  Device ID: $device_id"
    echo "  WiFi SSID: $wifi_ssid"
    
    if [ -n "$wifi_password" ]; then
        local masked_password=$(echo "$wifi_password" | sed 's/./*/g')
        echo "  WiFi Password: $masked_password (${#wifi_password} characters)"
    else
        echo "  WiFi Password: Not set"
    fi
    
    # Store credentials for summary
    WIFI_CREDENTIALS_FOUND=$((WIFI_CREDENTIALS_FOUND + 1))
    
    return 0
}

# Test setting WiFi credentials (optional)
test_set_wifi_credentials() {
    local device_id="$1"
    local device_name="$2"
    
    log "Testing WiFi credentials setting for device: $device_name"
    
    # Test data
    local test_ssid="TestWiFi_$(date +%s)"
    local test_password="TestPassword123"
    
    # Set WiFi credentials
    local set_response=$(curl -s -X POST \
        "${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${device_id}/attributes/SHARED_SCOPE" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{
            \"wifi_ssid\": \"${test_ssid}\",
            \"wifi_password\": \"${test_password}\"
        }")
    
    if [ $? -ne 0 ]; then
        log_error "Failed to set WiFi credentials for device $device_name"
        return 1
    fi
    
    log_success "Successfully set test WiFi credentials for device $device_name"
    echo "  Test SSID: $test_ssid"
    echo "  Test Password: $test_password"
    
    # Verify the credentials were set
    sleep 2
    local verify_response=$(curl -s -X GET \
        "${TB_BASE_URL}/api/plugins/telemetry/DEVICE/${device_id}/values/attributes/SHARED_SCOPE" \
        -H "Authorization: Bearer ${JWT_TOKEN}")
    
    local retrieved_ssid=$(echo "$verify_response" | jq -r '.wifi_ssid // empty')
    
    if [ "$retrieved_ssid" = "$test_ssid" ]; then
        log_success "WiFi credentials verification successful"
    else
        log_error "WiFi credentials verification failed"
        return 1
    fi
    
    return 0
}

# Main test function
main() {
    echo "=========================================="
    echo "🔍 ThingsBoard WiFi Credentials Test"
    echo "=========================================="
    echo ""
    
    # Initialize counters
    WIFI_CREDENTIALS_FOUND=0
    DEVICES_PROCESSED=0
    
    # Check dependencies
    check_dependencies
    
    # Authenticate
    authenticate
    
    # Get devices
    if ! get_devices; then
        log_error "No devices available for testing"
        exit 1
    fi
    
    echo ""
    log "Processing devices for WiFi credentials..."
    echo ""
    
    # Process each device
    local device_count=$(echo "$DEVICES_JSON" | jq '.data | length')
    
    for ((i=0; i<device_count; i++)); do
        local device=$(echo "$DEVICES_JSON" | jq ".data[$i]")
        local device_id=$(echo "$device" | jq -r '.id.id // .id // empty')
        local device_name=$(echo "$device" | jq -r '.name // "Unknown"')
        
        if [ -n "$device_id" ]; then
            DEVICES_PROCESSED=$((DEVICES_PROCESSED + 1))
            get_device_wifi_credentials "$device_id" "$device_name"
            echo ""
        fi
    done
    
    # Summary
    echo "=========================================="
    echo "📊 Test Summary"
    echo "=========================================="
    echo "Devices processed: $DEVICES_PROCESSED"
    echo "Devices with WiFi credentials: $WIFI_CREDENTIALS_FOUND"
    echo ""
    
    if [ "$WIFI_CREDENTIALS_FOUND" -gt 0 ]; then
        log_success "WiFi credentials test completed successfully!"
        log_success "Found WiFi credentials in $WIFI_CREDENTIALS_FOUND out of $DEVICES_PROCESSED devices"
    else
        log_warning "No WiFi credentials found in any devices"
        log_warning "This might be expected if devices haven't been provisioned with WiFi credentials yet"
    fi
    
    echo ""
    echo "=========================================="
    echo "✅ Test completed"
    echo "=========================================="
}

# Run main function
main "$@"
