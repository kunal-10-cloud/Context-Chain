import requests
import sys
import json
from datetime import datetime

class ContextHubAPITester:
    def __init__(self, base_url="https://context-chain.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.project_id = None
        self.session_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success and response.get('status') == 'ok'

    def test_models_list(self):
        """Test models endpoint"""
        success, response = self.run_test(
            "Models List",
            "GET", 
            "models",
            200
        )
        if success:
            models = response if isinstance(response, list) else []
            print(f"   Found {len(models)} models")
            expected_models = ["gpt-5.2", "gpt-4o", "claude-sonnet-4.5", "claude-opus-4.5", "gemini-3-flash"]
            model_keys = [m.get('key') for m in models]
            missing = [m for m in expected_models if m not in model_keys]
            if missing:
                print(f"   Missing models: {missing}")
                return False
            return len(models) == 5
        return False

    def test_create_project(self):
        """Test project creation"""
        test_data = {
            "name": f"Test Project {datetime.now().strftime('%H%M%S')}",
            "description": "Test project for API testing"
        }
        success, response = self.run_test(
            "Create Project",
            "POST",
            "projects",
            200,
            data=test_data
        )
        if success and 'id' in response:
            self.project_id = response['id']
            print(f"   Created project ID: {self.project_id}")
            return True
        return False

    def test_list_projects(self):
        """Test listing projects"""
        success, response = self.run_test(
            "List Projects",
            "GET",
            "projects", 
            200
        )
        if success:
            projects = response if isinstance(response, list) else []
            print(f"   Found {len(projects)} projects")
            return len(projects) > 0
        return False

    def test_create_session(self):
        """Test session creation"""
        if not self.project_id:
            print("❌ No project ID available for session creation")
            return False
            
        test_data = {
            "project_id": self.project_id,
            "title": "Test Session",
            "model": "gpt-4o"  # Using gpt-4o for speed as requested
        }
        success, response = self.run_test(
            "Create Session",
            "POST",
            "sessions",
            200,
            data=test_data
        )
        if success and 'id' in response:
            self.session_id = response['id']
            print(f"   Created session ID: {self.session_id}")
            return True
        return False

    def test_list_sessions(self):
        """Test listing sessions"""
        params = {"project_id": self.project_id} if self.project_id else None
        success, response = self.run_test(
            "List Sessions",
            "GET",
            "sessions",
            200,
            params=params
        )
        if success:
            sessions = response if isinstance(response, list) else []
            print(f"   Found {len(sessions)} sessions")
            return len(sessions) > 0
        return False

    def test_send_chat_message(self):
        """Test sending a chat message"""
        if not self.session_id:
            print("❌ No session ID available for chat")
            return False
            
        test_data = {
            "session_id": self.session_id,
            "content": "Hello! This is a test message. Please respond briefly."
        }
        success, response = self.run_test(
            "Send Chat Message",
            "POST",
            "chat",
            200,
            data=test_data
        )
        if success and 'message' in response:
            message = response['message']
            print(f"   AI Response: {message.get('content', '')[:100]}...")
            return True
        return False

    def test_get_messages(self):
        """Test getting session messages"""
        if not self.session_id:
            print("❌ No session ID available for messages")
            return False
            
        success, response = self.run_test(
            "Get Session Messages",
            "GET",
            f"sessions/{self.session_id}/messages",
            200
        )
        if success:
            messages = response if isinstance(response, list) else []
            print(f"   Found {len(messages)} messages")
            return len(messages) >= 2  # Should have user + assistant message
        return False

    def test_extract_intelligence(self):
        """Test intelligence extraction"""
        if not self.session_id:
            print("❌ No session ID available for extraction")
            return False
            
        success, response = self.run_test(
            "Extract Intelligence",
            "POST",
            f"sessions/{self.session_id}/extract",
            200
        )
        if success and 'items' in response:
            items = response['items']
            print(f"   Extracted {len(items)} intelligence items")
            return True
        return False

    def test_get_intelligence(self):
        """Test getting intelligence items"""
        params = {"project_id": self.project_id} if self.project_id else None
        success, response = self.run_test(
            "Get Intelligence",
            "GET",
            "intelligence",
            200,
            params=params
        )
        if success:
            items = response if isinstance(response, list) else []
            print(f"   Found {len(items)} intelligence items")
            return True
        return False

def main():
    print("🚀 Starting Context Hub API Tests...")
    print("=" * 50)
    
    tester = ContextHubAPITester()
    
    # Run all tests in sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("Models List", tester.test_models_list),
        ("Create Project", tester.test_create_project),
        ("List Projects", tester.test_list_projects),
        ("Create Session", tester.test_create_session),
        ("List Sessions", tester.test_list_sessions),
        ("Send Chat Message", tester.test_send_chat_message),
        ("Get Messages", tester.test_get_messages),
        ("Extract Intelligence", tester.test_extract_intelligence),
        ("Get Intelligence", tester.test_get_intelligence),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if not result:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())