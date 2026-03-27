(function () {
  function getPriorityColorName(priority) {
    switch (priority) {
      case 'urgent':
        return 'red';
      case 'important':
        return 'orange';
      case 'simple':
        return 'yellow';
      case 'money':
        return 'green';
      default:
        return 'default';
    }
  }

  window.FlowlyTaskComponents = {
    getPriorityColorName: getPriorityColorName
  };
})();
