package com.vince.event;

import static com.vince.WebSocketConfiguration.*;

import com.vince.model.Project;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.rest.core.annotation.HandleAfterCreate;
import org.springframework.data.rest.core.annotation.HandleAfterDelete;
import org.springframework.data.rest.core.annotation.HandleAfterSave;
import org.springframework.data.rest.core.annotation.RepositoryEventHandler;
import org.springframework.hateoas.EntityLinks;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Created by vince on 19/09/16.
 */
@Component
@RepositoryEventHandler(Project.class)
public class EventHandler {

    private final SimpMessagingTemplate websocket;

    private final EntityLinks entityLinks;

    @Autowired
    public EventHandler(SimpMessagingTemplate websocket, EntityLinks entityLinks) {
        this.websocket = websocket;
        this.entityLinks = entityLinks;
    }

    @HandleAfterCreate
    public void newProject(Project project) {
        this.websocket.convertAndSend(
                MESSAGE_PREFIX + "/newProject", getPath(project));
    }

    @HandleAfterDelete
    public void deleteProject(Project project) {
        this.websocket.convertAndSend(
                MESSAGE_PREFIX + "/deleteProject", getPath(project));
    }

    @HandleAfterSave
    public void updateEmployee(Project project) {
        this.websocket.convertAndSend(
                MESSAGE_PREFIX + "/updateProject", getPath(project));
    }

    /**
     * Take an {@link Project} and get the URI using Spring Data REST's {@link EntityLinks}.
     *
     * @param project
     */
    private String getPath(Project project) {
        return this.entityLinks.linkForSingleResource(project.getClass(),
                project.getId()).toUri().getPath();
    }

}